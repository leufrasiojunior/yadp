import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeBlockingStatus,
  PiholeManagedInstanceSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { ApplyBlockingOperationDto } from "./dto/apply-blocking-operation.dto";
import type { PreviewBlockingOperationDto } from "./dto/preview-blocking-operation.dto";
import type { UpdateBlockingPresetsDto } from "./dto/update-blocking-presets.dto";
import type {
  SyncBlockingAggregate,
  SyncBlockingApplyResponse,
  SyncBlockingApplyResultStatus,
  SyncBlockingInstanceStatus,
  SyncBlockingPreset,
  SyncBlockingPreviewInstance,
  SyncBlockingPreviewResponse,
  SyncBlockingStatusResponse,
} from "./sync.types";

type DesiredBlockingConfig = {
  blocking: boolean;
  timerSeconds: number | null;
};

type BlockingStateLike = {
  blocking: PiholeBlockingStatus | null;
  timerSeconds?: number | null;
  timer?: number | null;
};

type InternalBlockingInstanceStatus = SyncBlockingInstanceStatus & {
  kind: PiholeRequestErrorKind | null;
};

type ApplyAttemptResult = {
  instanceId: string;
  instanceName: string;
  status: SyncBlockingApplyResultStatus;
  message: string | null;
  blocking: PiholeBlockingStatus | null;
  timerSeconds: number | null;
};

const SYNC_BLOCKING_OPERATION_KEY = "BLOCKING";
const SYNC_BLOCKING_SCOPE = "all";
const SYNC_BLOCKING_MAX_ATTEMPTS = 3;
const DEFAULT_BLOCKING_PRESETS = [
  { name: "10s", timerSeconds: 10, sortOrder: 10 },
  { name: "30s", timerSeconds: 30, sortOrder: 20 },
  { name: "5m", timerSeconds: 300, sortOrder: 30 },
] as const;

@Injectable()
export class SyncService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getBlockingStatus(request: Request): Promise<SyncBlockingStatusResponse> {
    const locale = getRequestLocale(request);
    const [snapshot, presets] = await Promise.all([this.loadBlockingSnapshot(locale), this.readBlockingPresets()]);

    return {
      aggregate: snapshot.aggregate,
      instances: snapshot.instances.map((instance) => ({
        instanceId: instance.instanceId,
        instanceName: instance.instanceName,
        instanceAddress: instance.instanceAddress,
        blocking: instance.blocking,
        timerSeconds: instance.timerSeconds,
        reachable: instance.reachable,
        ...(instance.message ? { message: instance.message } : {}),
      })),
      presets,
    };
  }

  async updateBlockingPresets(dto: UpdateBlockingPresetsDto, request: Request) {
    const ipAddress = getRequestIp(request);
    const presets = this.normalizeBlockingPresets(dto.presets);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.syncOperationPreset.deleteMany({
          where: {
            operationKey: SYNC_BLOCKING_OPERATION_KEY,
          },
        });

        if (presets.length === 0) {
          return;
        }

        await tx.syncOperationPreset.createMany({
          data: presets.map((preset, index) => ({
            operationKey: SYNC_BLOCKING_OPERATION_KEY,
            name: preset.name,
            timerSeconds: preset.timerSeconds,
            sortOrder: index,
          })),
        });
      });

      const savedPresets = await this.readBlockingPresets();

      await this.audit.record({
        action: "sync.blocking.presets.update",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: SYNC_BLOCKING_OPERATION_KEY,
        result: "SUCCESS",
        details: {
          presetCount: savedPresets.length,
          presets: savedPresets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            timerSeconds: preset.timerSeconds,
            sortOrder: preset.sortOrder,
          })),
        } satisfies Prisma.InputJsonObject,
      });

      return {
        presets: savedPresets,
      };
    } catch (error) {
      await this.audit.record({
        action: "sync.blocking.presets.update",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: SYNC_BLOCKING_OPERATION_KEY,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          presetCount: presets.length,
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async previewBlocking(dto: PreviewBlockingOperationDto, request: Request): Promise<SyncBlockingPreviewResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const desiredConfig = this.normalizeDesiredBlockingConfig(dto, locale);

    try {
      const snapshot = await this.loadBlockingSnapshot(locale);
      const readyInstances: SyncBlockingPreviewResponse["readyInstances"] = [];
      const noopInstances: SyncBlockingPreviewResponse["noopInstances"] = [];
      const failedInstances: SyncBlockingPreviewResponse["failedInstances"] = [];

      for (const instance of snapshot.instances) {
        if (!instance.reachable || instance.blocking === null) {
          failedInstances.push({
            instanceId: instance.instanceId,
            instanceName: instance.instanceName,
            kind: instance.kind ?? "unknown",
            message: instance.message ?? translateApi(locale, "pihole.unreachable", { baseUrl: instance.instanceName }),
          });
          continue;
        }

        const previewInstance: SyncBlockingPreviewInstance = {
          instanceId: instance.instanceId,
          instanceName: instance.instanceName,
          blocking: instance.blocking,
          timerSeconds: instance.timerSeconds,
        };

        if (this.matchesDesiredBlockingState(instance, desiredConfig)) {
          noopInstances.push(previewInstance);
          continue;
        }

        readyInstances.push(previewInstance);
      }

      await this.audit.record({
        action: "sync.blocking.preview",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: SYNC_BLOCKING_OPERATION_KEY,
        result: "SUCCESS",
        details: {
          desiredConfig: this.toDesiredConfigJson(desiredConfig),
          readyCount: readyInstances.length,
          noopCount: noopInstances.length,
          failedCount: failedInstances.length,
          failedInstances: failedInstances as unknown as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        desiredConfig: {
          blocking: desiredConfig.blocking,
          timerSeconds: desiredConfig.timerSeconds,
        },
        aggregate: snapshot.aggregate,
        readyInstances,
        noopInstances,
        failedInstances,
      };
    } catch (error) {
      await this.audit.record({
        action: "sync.blocking.preview",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: SYNC_BLOCKING_OPERATION_KEY,
        result: "FAILURE",
        details: {
          desiredConfig: this.toDesiredConfigJson(desiredConfig),
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async applyBlocking(dto: ApplyBlockingOperationDto, request: Request): Promise<SyncBlockingApplyResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const desiredConfig = this.normalizeDesiredBlockingConfig(dto, locale);
    const managedInstances = await this.loadManagedInstances(locale);
    const targetInstanceIds = this.normalizeTargetInstanceIds(dto.targetInstanceIds, managedInstances, locale);

    if (targetInstanceIds.length === 0) {
      throw new BadRequestException(translateApi(locale, "sync.emptyTargetSelection"));
    }

    try {
      const nonTargetResults = await this.classifyNonTargetInstances(
        managedInstances.filter((instance) => !targetInstanceIds.includes(instance.id)),
        desiredConfig,
        locale,
      );
      const syncJob = await this.prisma.syncJob.create({
        data: {
          operationKey: SYNC_BLOCKING_OPERATION_KEY,
          scope: SYNC_BLOCKING_SCOPE,
          requestedConfig: this.toDesiredConfigJson(desiredConfig),
          status: "RUNNING",
        },
      });

      for (const result of nonTargetResults) {
        await this.createSyncAttempt(syncJob.id, result.instanceId, 1, result.status, result.message, desiredConfig, {
          blocking: result.blocking,
          timerSeconds: result.timerSeconds,
        });
      }

      const targetInstances = managedInstances.filter((instance) => targetInstanceIds.includes(instance.id));
      const settled = await Promise.all(
        targetInstances.map((instance) => this.applyBlockingToInstance(syncJob.id, instance, desiredConfig, locale)),
      );
      const results = [...settled, ...nonTargetResults].sort((left, right) =>
        left.instanceName.localeCompare(right.instanceName),
      );
      const summary = this.buildApplySummary(results);
      const jobStatus =
        summary.failedCount === 0 && summary.skippedCount === 0
          ? "SUCCESS"
          : summary.failedCount === summary.totalInstances
            ? "FAILURE"
            : "PARTIAL";
      const finishedAt = new Date();

      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: jobStatus,
          finishedAt,
          summary: summary satisfies Prisma.InputJsonObject,
        },
      });

      await this.audit.record({
        action: "sync.blocking.apply",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: syncJob.id,
        result: summary.failedCount > 0 ? "FAILURE" : "SUCCESS",
        details: {
          desiredConfig: this.toDesiredConfigJson(desiredConfig),
          summary,
          failedInstances: results.filter((result) => result.status === "FAILURE") as unknown as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        job: {
          id: syncJob.id,
          operationKey: SYNC_BLOCKING_OPERATION_KEY,
          status: jobStatus,
          startedAt: syncJob.startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        },
        summary,
        instances: results,
      };
    } catch (error) {
      await this.audit.record({
        action: "sync.blocking.apply",
        actorType: "session",
        ipAddress,
        targetType: "sync",
        targetId: SYNC_BLOCKING_OPERATION_KEY,
        result: "FAILURE",
        details: {
          desiredConfig: this.toDesiredConfigJson(desiredConfig),
          targetInstanceIds,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  private async loadBlockingSnapshot(locale: ReturnType<typeof getRequestLocale>): Promise<{
    aggregate: SyncBlockingAggregate;
    instances: InternalBlockingInstanceStatus[];
  }> {
    const instances = await this.loadManagedInstances(locale);
    const settled = await Promise.allSettled(
      instances.map((instance) => this.readBlockingForInstance(instance, locale)),
    );
    const results: InternalBlockingInstanceStatus[] = [];

    settled.forEach((result, index) => {
      const instance = instances[index];

      if (!instance) {
        return;
      }

      if (result.status === "fulfilled") {
        results.push(result.value);
        return;
      }

      const failure = this.mapBlockingFailure(instance, result.reason, locale);

      results.push({
        instanceId: instance.id,
        instanceName: instance.name,
        instanceAddress: this.extractInstanceAddress(instance.baseUrl),
        blocking: null,
        timerSeconds: null,
        reachable: false,
        message: failure.message,
        kind: failure.kind,
      });
    });

    return {
      aggregate: this.buildBlockingAggregate(results),
      instances: results,
    };
  }

  private async readBlockingForInstance(
    instance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InternalBlockingInstanceStatus> {
    return this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
      const blocking = await this.pihole.getBlocking(connection, session);

      return {
        instanceId: instance.id,
        instanceName: instance.name,
        instanceAddress: this.extractInstanceAddress(instance.baseUrl),
        blocking: blocking.blocking,
        timerSeconds: blocking.timer,
        reachable: true,
        kind: null,
      };
    });
  }

  private buildBlockingAggregate(instances: InternalBlockingInstanceStatus[]): SyncBlockingAggregate {
    if (instances.some((instance) => !instance.reachable)) {
      return {
        status: "partial",
        timerSeconds: null,
      };
    }

    const reachableInstances = instances.filter(
      (instance): instance is InternalBlockingInstanceStatus & { blocking: PiholeBlockingStatus } =>
        instance.reachable && instance.blocking !== null,
    );

    if (reachableInstances.length === 0) {
      return {
        status: "partial",
        timerSeconds: null,
      };
    }

    if (reachableInstances.every((instance) => instance.blocking === "enabled")) {
      return {
        status: "enabled",
        timerSeconds: null,
      };
    }

    if (reachableInstances.every((instance) => instance.blocking === "disabled")) {
      const firstTimer = reachableInstances[0]?.timerSeconds ?? null;
      const hasSameTimer = reachableInstances.every((instance) => instance.timerSeconds === firstTimer);

      if (hasSameTimer) {
        return {
          status: "disabled",
          timerSeconds: firstTimer,
        };
      }
    }

    return {
      status: "mixed",
      timerSeconds: null,
    };
  }

  private normalizeDesiredBlockingConfig(
    dto: PreviewBlockingOperationDto | ApplyBlockingOperationDto,
    locale: ReturnType<typeof getRequestLocale>,
  ): DesiredBlockingConfig {
    const timerSeconds = dto.timerSeconds ?? null;

    if (dto.blocking && timerSeconds !== null) {
      throw new BadRequestException(translateApi(locale, "sync.blockingEnableTimerInvalid"));
    }

    return {
      blocking: dto.blocking,
      timerSeconds,
    };
  }

  private matchesDesiredBlockingState(current: BlockingStateLike, desiredConfig: DesiredBlockingConfig) {
    if (current.blocking === null) {
      return false;
    }

    const currentTimer = "timerSeconds" in current ? current.timerSeconds : current.timer;
    const desiredBlockingState = desiredConfig.blocking ? "enabled" : "disabled";

    return current.blocking === desiredBlockingState && currentTimer === desiredConfig.timerSeconds;
  }

  private async classifyNonTargetInstances(
    instances: PiholeManagedInstanceSummary[],
    desiredConfig: DesiredBlockingConfig,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const results = await Promise.all(
      instances.map(async (instance): Promise<ApplyAttemptResult> => {
        try {
          const current = await this.readBlockingForInstance(instance, locale);

          if (current.blocking === null || !this.matchesDesiredBlockingState(current, desiredConfig)) {
            throw new BadRequestException(translateApi(locale, "sync.invalidTargetInstances"));
          }

          return {
            instanceId: instance.id,
            instanceName: instance.name,
            status: "NOOP",
            message: translateApi(locale, "sync.blockingAlreadyDesired"),
            blocking: current.blocking,
            timerSeconds: current.timerSeconds,
          };
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }

          const failure = this.mapBlockingFailure(instance, error, locale);
          return {
            instanceId: instance.id,
            instanceName: instance.name,
            status: "SKIPPED",
            message: `${translateApi(locale, "sync.precheckFailedSkip")} ${failure.message}`,
            blocking: null,
            timerSeconds: null,
          };
        }
      }),
    );

    return results;
  }

  private async applyBlockingToInstance(
    syncJobId: string,
    instance: PiholeManagedInstanceSummary,
    desiredConfig: DesiredBlockingConfig,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<ApplyAttemptResult> {
    for (let attemptNumber = 1; attemptNumber <= SYNC_BLOCKING_MAX_ATTEMPTS; attemptNumber += 1) {
      try {
        const result = await this.instanceSessions.withActiveSession(
          instance.id,
          locale,
          async ({ connection, session }) => {
            const current = await this.pihole.getBlocking(connection, session);

            if (this.matchesDesiredBlockingState(current, desiredConfig)) {
              return {
                status: "NOOP" as const,
                response: current,
                message: translateApi(locale, "sync.blockingAlreadyDesired"),
              };
            }

            const updated = await this.pihole.setBlocking(connection, session, {
              blocking: desiredConfig.blocking,
              timer: desiredConfig.timerSeconds,
            });

            return {
              status: "SUCCESS" as const,
              response: updated,
              message: null,
            };
          },
        );

        await this.createSyncAttempt(
          syncJobId,
          instance.id,
          attemptNumber,
          result.status,
          result.message,
          desiredConfig,
          {
            blocking: result.response.blocking,
            timerSeconds: result.response.timer,
            took: result.response.took,
          },
        );

        return {
          instanceId: instance.id,
          instanceName: instance.name,
          status: result.status,
          message: result.message,
          blocking: result.response.blocking,
          timerSeconds: result.response.timer,
        };
      } catch (error) {
        const failure = this.mapBlockingFailure(instance, error, locale);

        await this.createSyncAttempt(syncJobId, instance.id, attemptNumber, "FAILURE", failure.message, desiredConfig, {
          kind: failure.kind,
          message: failure.message,
        });

        if (attemptNumber >= SYNC_BLOCKING_MAX_ATTEMPTS) {
          return {
            instanceId: instance.id,
            instanceName: instance.name,
            status: "FAILURE",
            message: failure.message,
            blocking: null,
            timerSeconds: null,
          };
        }
      }
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      status: "FAILURE",
      message: translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
      blocking: null,
      timerSeconds: null,
    };
  }

  private buildApplySummary(results: ApplyAttemptResult[]): SyncBlockingApplyResponse["summary"] {
    return results.reduce<SyncBlockingApplyResponse["summary"]>(
      (summary, result) => {
        summary.totalInstances += 1;

        switch (result.status) {
          case "SUCCESS":
            summary.successfulCount += 1;
            break;
          case "FAILURE":
            summary.failedCount += 1;
            break;
          case "NOOP":
            summary.noopCount += 1;
            break;
          case "SKIPPED":
            summary.skippedCount += 1;
            break;
        }

        return summary;
      },
      {
        successfulCount: 0,
        failedCount: 0,
        noopCount: 0,
        skippedCount: 0,
        totalInstances: 0,
      },
    );
  }

  private async createSyncAttempt(
    syncJobId: string,
    instanceId: string,
    attemptNumber: number,
    status: SyncBlockingApplyResultStatus,
    message: string | null,
    desiredConfig: DesiredBlockingConfig,
    responsePayload: Prisma.InputJsonValue,
  ) {
    await this.prisma.syncAttempt.create({
      data: {
        syncJobId,
        instanceId,
        attemptNumber,
        status,
        message,
        requestPayload: this.toDesiredConfigJson(desiredConfig),
        responsePayload,
      },
    });
  }

  private async readBlockingPresets(): Promise<SyncBlockingPreset[]> {
    const presets = await this.prisma.syncOperationPreset.findMany({
      where: {
        operationKey: SYNC_BLOCKING_OPERATION_KEY,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        timerSeconds: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    if (presets.length === 0) {
      await this.prisma.syncOperationPreset.createMany({
        data: DEFAULT_BLOCKING_PRESETS.map((preset) => ({
          operationKey: SYNC_BLOCKING_OPERATION_KEY,
          name: preset.name,
          timerSeconds: preset.timerSeconds,
          sortOrder: preset.sortOrder,
        })),
      });

      return this.readBlockingPresets();
    }

    const hasLegacyPreset = presets.some((preset) => {
      const trimmedName = preset.name.trim();

      return trimmedName.length === 0 || trimmedName === "Saved preset";
    });

    if (hasLegacyPreset) {
      const repairedPresets = [...presets]
        .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.getTime() - right.createdAt.getTime())
        .map((preset, index) => ({
          name: this.normalizeBlockingPresetName(preset.name, preset.timerSeconds),
          timerSeconds: preset.timerSeconds,
          sortOrder: index * 10 + 10,
        }));

      for (const preset of DEFAULT_BLOCKING_PRESETS) {
        if (repairedPresets.some((item) => item.timerSeconds === preset.timerSeconds)) {
          continue;
        }

        repairedPresets.push({
          name: preset.name,
          timerSeconds: preset.timerSeconds,
          sortOrder: preset.sortOrder,
        });
      }

      const normalizedRepairedPresets = repairedPresets
        .sort((left, right) => left.sortOrder - right.sortOrder || left.timerSeconds - right.timerSeconds)
        .map((preset, index) => ({
          name: preset.name,
          timerSeconds: preset.timerSeconds,
          sortOrder: index * 10 + 10,
        }));

      await this.prisma.$transaction(async (tx) => {
        await tx.syncOperationPreset.deleteMany({
          where: {
            operationKey: SYNC_BLOCKING_OPERATION_KEY,
          },
        });

        await tx.syncOperationPreset.createMany({
          data: normalizedRepairedPresets.map((preset) => ({
            operationKey: SYNC_BLOCKING_OPERATION_KEY,
            name: preset.name,
            timerSeconds: preset.timerSeconds,
            sortOrder: preset.sortOrder,
          })),
        });
      });

      return this.readBlockingPresets();
    }

    return presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      timerSeconds: preset.timerSeconds,
      sortOrder: preset.sortOrder,
    }));
  }

  private normalizeBlockingPresetName(name: string, timerSeconds: number) {
    const trimmedName = name.trim();

    if (trimmedName.length > 0 && trimmedName !== "Saved preset") {
      return trimmedName;
    }

    const defaultPreset = DEFAULT_BLOCKING_PRESETS.find((preset) => preset.timerSeconds === timerSeconds);

    if (defaultPreset) {
      return defaultPreset.name;
    }

    if (timerSeconds >= 60 && timerSeconds % 60 === 0) {
      return `${timerSeconds / 60}m`;
    }

    return `${timerSeconds}s`;
  }

  private normalizeBlockingPresets(presets: UpdateBlockingPresetsDto["presets"]) {
    return presets.map((preset, index) => {
      const name = preset.name.trim();

      if (name.length === 0) {
        throw new BadRequestException(`Preset #${index + 1} is missing a name.`);
      }

      return {
        name,
        timerSeconds: preset.timerSeconds,
      };
    });
  }

  private async loadManagedInstances(locale: ReturnType<typeof getRequestLocale>) {
    const instances = await this.instanceSessions.listInstanceSummaries();

    if (instances.length === 0) {
      throw new NotFoundException(translateApi(locale, "sync.noInstances"));
    }

    return instances;
  }

  private normalizeTargetInstanceIds(
    targetInstanceIds: string[],
    instances: PiholeManagedInstanceSummary[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const uniqueIds = Array.from(new Set(targetInstanceIds));
    const validIds = new Set(instances.map((instance) => instance.id));

    if (uniqueIds.some((instanceId) => !validIds.has(instanceId))) {
      throw new BadRequestException(translateApi(locale, "sync.invalidTargetInstances"));
    }

    return uniqueIds;
  }

  private mapBlockingFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: error.message,
      };
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: "unknown" as const,
        message: error.message,
      };
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown" as const,
      message: translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private extractInstanceAddress(baseUrl: string) {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return baseUrl;
    }
  }

  private toDesiredConfigJson(desiredConfig: DesiredBlockingConfig) {
    return {
      blocking: desiredConfig.blocking,
      timerSeconds: desiredConfig.timerSeconds,
    } satisfies Prisma.InputJsonObject;
  }
}
