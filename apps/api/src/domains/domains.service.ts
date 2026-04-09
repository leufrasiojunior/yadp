import { BadRequestException, Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeDomainMutationResult,
  PiholeDomainOperationKind,
  PiholeDomainOperationType,
  PiholeManagedInstanceSummary,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import {
  DEFAULT_DOMAIN_OPERATION_COMMENT,
  type DomainItem,
  type DomainOperationKind,
  type DomainOperationResponse,
  type DomainOperationType,
  type DomainScopeMode,
  type DomainsInstanceFailure,
  type DomainsInstanceSource,
  type DomainsListResponse,
  type DomainsMutationResponse,
} from "./domains.types";
import type { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
import type { BatchDeleteDomainsDto } from "./dto/batch-delete-domains.dto";
import type { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";
import type { SyncDomainsDto } from "./dto/sync-domains.dto";
import type { UpdateDomainDto } from "./dto/update-domain.dto";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedDomainRecord = Omit<DomainItem, "origin" | "sync">;

type InstanceDomainsSnapshot = {
  instance: ManagedInstanceRecord;
  domainsByKey: Map<string, ManagedDomainRecord>;
};

type DomainSnapshotsResult = {
  snapshots: InstanceDomainsSnapshot[];
  unavailableInstances: DomainsInstanceFailure[];
};

@Injectable()
export class DomainsService implements OnModuleInit {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.seedRegexFilters();
  }

  private async seedRegexFilters() {
    const filters = [
      {
        name: "Bloquear um nome exato com TLD específico",
        pattern: "(\\.|^)domain\\.com$",
        description: "Exemplo: matches google.com but not mygoogle.com",
      },
      {
        name: "Bloquear um nome exato com qualquer TLD",
        pattern: "(^|\\.)domain(\\.[a-z]{2,})+$",
        description: "Exemplo: matches google.com, google.net, google.org, etc.",
      },
    ];

    for (const filter of filters) {
      try {
        await this.prisma.regexFilter.upsert({
          where: { name: filter.name },
          update: { pattern: filter.pattern, description: filter.description },
          create: { name: filter.name, pattern: filter.pattern, description: filter.description },
        });
      } catch (error) {
        this.logger.error(`Failed to seed regex filter ${filter.name}`, error);
      }
    }
  }

  async listDomains(request: Request): Promise<DomainsListResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots, unavailableInstances } = await this.prepareSnapshotsForList(instances, request);
    const consolidatedItems = this.buildListedDomains(snapshots, baseline.id);

    // Persist to secondary DB
    await Promise.all(
      consolidatedItems.map((item) =>
        this.prisma.managedDomain.upsert({
          where: {
            domain_type_kind: {
              domain: item.domain,
              type: item.type,
              kind: item.kind,
            },
          },
          update: {
            comment: item.comment,
            groups: item.groups,
            enabled: item.enabled,
          },
          create: {
            domain: item.domain,
            type: item.type,
            kind: item.kind,
            comment: item.comment,
            groups: item.groups,
            enabled: item.enabled,
          },
        }),
      ),
    );

    return {
      items: consolidatedItems,
      source: {
        baselineInstanceId: baseline.id,
        baselineInstanceName: baseline.name,
        totalInstances: instances.length,
        availableInstanceCount: snapshots.length,
        unavailableInstanceCount: unavailableInstances.length,
      },
      unavailableInstances,
    };
  }

  async applyDomainOperation(
    params: DomainOperationParamsDto,
    body: ApplyDomainOperationDto,
    request: Request,
  ): Promise<DomainOperationResponse> {
    const locale = getRequestLocale(request);
    const normalizedDomain = body.domain.trim().toLowerCase();
    const comment = body.comment ?? DEFAULT_DOMAIN_OPERATION_COMMENT;
    const value = params.kind === "regex" ? this.buildRegexPattern(normalizedDomain, body.comment) : normalizedDomain;
    const effectiveScope = params.type === "deny" && params.kind === "exact" ? "all" : body.scope;
    const effectiveInstanceId = effectiveScope === "instance" ? body.instanceId : undefined;
    const instances = await this.resolveRequestedInstances(effectiveScope, effectiveInstanceId, locale);

    // Save to local DB first
    await this.prisma.managedDomain.upsert({
      where: {
        domain_type_kind: {
          domain: value,
          type: params.type,
          kind: params.kind,
        },
      },
      update: { comment, enabled: true, groups: [0] },
      create: {
        domain: value,
        type: params.type,
        kind: params.kind,
        comment,
        enabled: true,
        groups: [0],
      },
    });

    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          const result = await this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
            this.pihole.applyDomainOperation(connection, session, {
              type: params.type as PiholeDomainOperationType,
              kind: params.kind as PiholeDomainOperationKind,
              value,
              comment,
              groups: [0],
              enabled: true,
            }),
          );

          if (result.processed.errors.length > 0) {
            return {
              status: "rejected" as const,
              instance,
              failure: this.mapProcessedFailure(instance, result, locale),
            };
          }

          return {
            status: "fulfilled" as const,
            instance,
            result,
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            instance,
            failure: this.mapInstanceFailure(instance, error, locale),
          };
        }
      }),
    );

    const successfulInstances: Array<
      DomainsInstanceSource & { processed: PiholeDomainMutationResult["processed"]; took: number | null }
    > = [];
    const failedInstances: DomainsInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successfulInstances.push({
          instanceId: item.instance.id,
          instanceName: item.instance.name,
          processed: item.result.processed,
          took: item.result.took,
        });
      } else {
        failedInstances.push(item.failure);
      }
    }

    await this.audit.record({
      action: "domains.create",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "domain",
      targetId: value,
      result: failedInstances.length === 0 ? "SUCCESS" : "FAILURE",
      details: {
        params: params as unknown as Prisma.InputJsonValue,
        body: body as unknown as Prisma.InputJsonValue,
        summary: {
          totalInstances: instances.length,
          successfulCount: successfulInstances.length,
          failedCount: failedInstances.length,
        },
      },
    });

    return {
      request: {
        type: params.type as DomainOperationType,
        kind: params.kind as DomainOperationKind,
        domain: normalizedDomain,
        value,
        comment,
        scope: effectiveScope,
        instanceId: effectiveInstanceId ?? null,
      },
      summary: {
        totalInstances: instances.length,
        successfulCount: successfulInstances.length,
        failedCount: failedInstances.length,
      },
      successfulInstances,
      failedInstances,
    };
  }

  async updateDomain(
    domain: string,
    type: string,
    kind: string,
    body: UpdateDomainDto,
    request: Request,
  ): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.resolveRequestedInstances("all", undefined, locale);
    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    // Update local DB
    await this.prisma.managedDomain
      .update({
        where: { domain_type_kind: { domain, type, kind } },
        data: { comment: body.comment, groups: body.groups, enabled: body.enabled },
      })
      .catch(() => {
        // Ignore if not in local DB
      });

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          await this.pihole.updateDomain(connection, session, domain, type, kind, {
            comment: body.comment,
            groups: body.groups,
            enabled: body.enabled,
          });
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    await this.audit.record({
      action: "domains.update",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "domain",
      targetId: domain,
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: { domain, type, kind, body: body as unknown as Prisma.InputJsonValue, summary: results.summary },
    });

    return results;
  }

  async batchDelete(body: BatchDeleteDomainsDto, request: Request): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.resolveRequestedInstances("all", undefined, locale);
    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    // Delete from local DB
    for (const item of body.items) {
      await this.prisma.managedDomain
        .delete({
          where: { domain_type_kind: { domain: item.item, type: item.type, kind: item.kind } },
        })
        .catch(() => {
          // Ignore if not in local DB
        });
    }

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const item of body.items) {
            await this.pihole.deleteDomain(connection, session, item.item, item.type, item.kind);
          }
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    return results;
  }

  async syncDomains(body: SyncDomainsDto, request: Request): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();

    if (body.domain && body.type && body.kind && body.sourceInstanceId && body.targetInstanceIds) {
      // Single sync
      const targetInstances = instances.filter((i) => body.targetInstanceIds?.includes(i.id));
      const results: DomainsMutationResponse = {
        status: "success",
        summary: { totalInstances: targetInstances.length, successfulCount: 0, failedCount: 0 },
        successfulInstances: [],
        failedInstances: [],
      };

      let sourceData: ManagedDomainRecord | null = null;
      try {
        await this.instanceSessions.withActiveSession(
          body.sourceInstanceId,
          locale,
          async ({ connection, session }) => {
            const result = await this.pihole.listDomains(connection, session);
            const entry = result.domains.find(
              (d) => d.domain === body.domain && d.type === body.type && d.kind === body.kind,
            );
            if (entry) {
              sourceData = {
                domain: entry.domain || "",
                unicode: entry.unicode,
                type: entry.type || "",
                kind: entry.kind || "",
                comment: entry.comment,
                groups: entry.groups,
                enabled: entry.enabled || false,
                id: entry.id || 0,
                dateAdded: entry.dateAdded,
                dateModified: entry.dateModified,
              };
            }
          },
        );
      } catch (error) {
        throw new BadRequestException(
          `Failed to read from source instance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!sourceData) throw new BadRequestException("Domain not found on source instance");

      const finalSourceData = sourceData;
      for (const instance of targetInstances) {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            await this.pihole.applyDomainOperation(connection, session, {
              type: finalSourceData.type as PiholeDomainOperationType,
              kind: finalSourceData.kind as PiholeDomainOperationKind,
              value: finalSourceData.domain,
              comment: finalSourceData.comment ?? undefined,
              groups: finalSourceData.groups,
              enabled: finalSourceData.enabled,
            });
          });
          results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
          results.summary.successfulCount++;
        } catch (error) {
          results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
          results.summary.failedCount++;
          results.status = "partial";
        }
      }
      return results;
    }

    // Bulk sync
    const { snapshots } = await this.prepareSnapshotsForList(instances, request);
    const allKeys = new Set<string>();
    for (const s of snapshots) for (const key of s.domainsByKey.keys()) allKeys.add(key);

    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    for (const instance of instances) {
      const snapshot = snapshots.find((s) => s.instance.id === instance.id);
      const missingKeys = [...allKeys].filter((key) => !snapshot?.domainsByKey.has(key));

      if (missingKeys.length === 0) {
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
        continue;
      }

      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const key of missingKeys) {
            const sourceSnap =
              snapshots.find((s) => s.instance.isBaseline && s.domainsByKey.has(key)) ||
              snapshots.find((s) => s.domainsByKey.has(key));
            const data = sourceSnap?.domainsByKey.get(key);
            if (data) {
              await this.pihole.applyDomainOperation(connection, session, {
                type: data.type as PiholeDomainOperationType,
                kind: data.kind as PiholeDomainOperationKind,
                value: data.domain,
                comment: data.comment ?? undefined,
                groups: data.groups,
                enabled: data.enabled,
              });
            }
          }
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        results.summary.failedCount++;
        results.status = "partial";
      }
    }
    return results;
  }

  private async loadManagedInstances(): Promise<ManagedInstanceRecord[]> {
    const instances = await this.prisma.instance.findMany({
      select: { id: true, name: true, baseUrl: true, isBaseline: true },
      orderBy: { name: "asc" },
    });
    return instances.map((i) => ({ ...i }));
  }

  private async prepareSnapshotsForList(
    instances: ManagedInstanceRecord[],
    request: Request,
  ): Promise<DomainSnapshotsResult> {
    const locale = getRequestLocale(request);
    const snapshots: InstanceDomainsSnapshot[] = [];
    const unavailableInstances: DomainsInstanceFailure[] = [];

    await Promise.all(
      instances.map(async (instance) => {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            const result = await this.pihole.listDomains(connection, session);
            const domainsByKey = new Map<string, ManagedDomainRecord>();
            for (const entry of result.domains) {
              if (entry.domain && entry.type && entry.kind) {
                const key = `${entry.domain}-${entry.type}-${entry.kind}`;
                domainsByKey.set(key, {
                  domain: entry.domain,
                  unicode: entry.unicode,
                  type: entry.type,
                  kind: entry.kind,
                  comment: entry.comment,
                  groups: entry.groups,
                  enabled: entry.enabled ?? false,
                  id: entry.id ?? 0,
                  dateAdded: entry.dateAdded,
                  dateModified: entry.dateModified,
                });
              }
            }
            snapshots.push({ instance, domainsByKey });
          });
        } catch (error) {
          unavailableInstances.push(this.mapInstanceFailure(instance, error, locale));
        }
      }),
    );

    return { snapshots, unavailableInstances };
  }

  private buildListedDomains(snapshots: InstanceDomainsSnapshot[], baselineId: string): DomainItem[] {
    const allKeys = new Set<string>();
    for (const s of snapshots) for (const key of s.domainsByKey.keys()) allKeys.add(key);

    const items: DomainItem[] = [];
    for (const key of allKeys) {
      let referenceRecord: ManagedDomainRecord | null = null;
      let originInstanceId = "";
      let originInstanceName = "";

      const baselineSnap = snapshots.find((s) => s.instance.id === baselineId);
      const baselineRecord = baselineSnap?.domainsByKey.get(key);
      if (baselineRecord) {
        referenceRecord = baselineRecord;
        originInstanceId = baselineSnap?.instance.id || "";
        originInstanceName = baselineSnap?.instance.name || "";
      }

      const sourceInstances: DomainsInstanceSource[] = [];
      const missingInstances: DomainsInstanceSource[] = [];

      for (const snapshot of snapshots) {
        const snapRecord = snapshot.domainsByKey.get(key);
        if (snapRecord) {
          sourceInstances.push({ instanceId: snapshot.instance.id, instanceName: snapshot.instance.name });
          if (!referenceRecord) {
            referenceRecord = snapRecord;
            originInstanceId = snapshot.instance.id;
            originInstanceName = snapshot.instance.name;
          }
        } else {
          missingInstances.push({ instanceId: snapshot.instance.id, instanceName: snapshot.instance.name });
        }
      }

      if (referenceRecord) {
        items.push({
          ...referenceRecord,
          origin: { instanceId: originInstanceId, instanceName: originInstanceName },
          sync: { isFullySynced: missingInstances.length === 0, sourceInstances, missingInstances },
        });
      }
    }
    return items.sort((a, b) => a.domain.localeCompare(b.domain));
  }

  private buildRegexPattern(domain: string, comment?: string | null) {
    if (comment === "Bloquear um nome exato com TLD específico") {
      return `(\\.|^)${domain.replaceAll(".", "\\.")}\\.com$`;
    }
    if (comment === "Bloquear um nome exato com qualquer TLD") {
      const base = domain.split(".")[0];
      return `(^|\\.)${base}(\\.[a-z]{2,})+$`;
    }
    const escaped = domain.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return `(^|\\.)${escaped}$`;
  }

  private resolveRequestedInstances(
    scope: DomainScopeMode,
    instanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (scope === "instance") {
      if (!instanceId) {
        throw new BadRequestException(translateApi(locale, "domains.instanceIdRequired"));
      }
      return this.instanceSessions.getInstanceSummary(instanceId, locale).then((s) => [s]);
    }
    return this.instanceSessions.listInstanceSummaries();
  }

  private mapProcessedFailure(
    instance: PiholeManagedInstanceSummary,
    result: PiholeDomainMutationResult,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    const firstError = result.processed.errors.find(
      (item) => (item.message?.trim().length ?? 0) > 0 || (item.item?.trim().length ?? 0) > 0,
    );
    const message =
      firstError?.message ??
      (firstError?.item
        ? `${firstError.item}`
        : translateApi(locale, "domains.operationRejected", { baseUrl: instance.baseUrl }));
    return { instanceId: instance.id, instanceName: instance.name, kind: "pihole_response_error", message };
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: error.message || translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
      };
    }
    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
