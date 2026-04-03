import { BadGatewayException, BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeGroupMutationResult,
  PiholeManagedGroupEntry,
  PiholeManagedInstanceSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { BatchDeleteGroupsDto } from "./dto/batch-delete-groups.dto";
import type { CreateGroupsDto } from "./dto/create-groups.dto";
import { parseGroupNamesInput } from "./dto/group-validation";
import type { UpdateGroupDto } from "./dto/update-group.dto";
import type { UpdateGroupStatusDto } from "./dto/update-group-status.dto";
import type {
  GroupItem,
  GroupsListResponse,
  GroupsMutationInstanceFailure,
  GroupsMutationInstanceSource,
  GroupsMutationResponse,
} from "./groups.types";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedGroupRecord = GroupItem;

type InstanceGroupsSnapshot = {
  instance: ManagedInstanceRecord;
  groupsByName: Map<string, ManagedGroupRecord>;
};

type GroupSyncPlan = {
  create: ManagedGroupRecord[];
  update: ManagedGroupRecord[];
  delete: string[];
};

function sortGroupItems(items: ManagedGroupRecord[]) {
  return [...items].sort((left, right) => {
    if (left.id === 0 && right.id !== 0) {
      return -1;
    }

    if (left.id !== 0 && right.id === 0) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function isImmutableGroup(group: ManagedGroupRecord) {
  return group.id === 0;
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listGroups(request: Request): Promise<GroupsListResponse> {
    const locale = getRequestLocale(request);
    const baseline = await this.loadBaselineInstance(locale);
    const groups = await this.readGroupsSnapshot(baseline, locale);

    return {
      items: sortGroupItems([...groups.groupsByName.values()]),
      source: {
        baselineInstanceId: baseline.id,
        baselineInstanceName: baseline.name,
      },
    };
  }

  async createGroups(dto: CreateGroupsDto, request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const parsedNames = this.parseRequestedNames(dto.name, locale);
    const comment = this.normalizeComment(dto.comment);
    const enabled = dto.enabled ?? true;

    try {
      const instances = await this.loadManagedInstances(locale);
      const snapshots = await this.prepareSnapshots(instances, locale);
      const precheckFailures = this.collectCreateFailures(snapshots, parsedNames, locale);

      this.throwIfPrecheckFailed(precheckFailures);

      const response = await this.applyAcrossInstances(instances, locale, async (instance) => {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          const result = await this.pihole.createGroups(connection, session, {
            names: parsedNames,
            comment,
            enabled,
          });

          this.assertMutationSucceeded(result);
        });
      });

      await this.audit.record({
        action: "groups.create",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: parsedNames.length === 1 ? parsedNames[0] : null,
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          names: parsedNames,
          enabled,
          status: response.status,
          summary: response.summary,
          ...(comment !== undefined ? { comment } : {}),
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.create",
        actorType: "session",
        ipAddress,
        targetType: "group",
        result: "FAILURE",
        details: {
          names: parsedNames,
          enabled,
          error: error instanceof Error ? error.message : "Unknown error",
          ...(comment !== undefined ? { comment } : {}),
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async updateGroup(currentName: string, dto: UpdateGroupDto, request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const normalizedCurrentName = this.normalizeSingleGroupName(currentName, locale);
    const normalizedNextName = this.normalizeSingleGroupName(dto.name, locale);
    const normalizedComment = this.normalizeComment(dto.comment);

    try {
      const instances = await this.loadManagedInstances(locale);
      const snapshots = await this.prepareSnapshots(instances, locale);
      const resolution = this.resolveExistingGroups(snapshots, normalizedCurrentName, locale);
      const precheckFailures = [
        ...resolution.failures,
        ...this.collectRenameConflicts(snapshots, normalizedCurrentName, normalizedNextName, locale),
      ];

      this.throwIfPrecheckFailed(precheckFailures);

      const response = await this.applyAcrossInstances(instances, locale, async (instance) => {
        const currentGroup = resolution.groupsByInstanceId.get(instance.id);

        if (!currentGroup) {
          throw new BadRequestException(translateApi(locale, "groups.notFound", { name: normalizedCurrentName }));
        }

        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          const result = await this.pihole.updateGroup(connection, session, currentGroup.name, {
            name: normalizedNextName,
            comment: normalizedComment,
            enabled: currentGroup.enabled,
          });

          this.assertMutationSucceeded(result);
        });
      });

      await this.audit.record({
        action: "groups.update",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedCurrentName,
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          currentName: normalizedCurrentName,
          nextName: normalizedNextName,
          status: response.status,
          summary: response.summary,
          ...(normalizedComment !== undefined ? { comment: normalizedComment } : {}),
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.update",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedCurrentName,
        result: "FAILURE",
        details: {
          nextName: normalizedNextName,
          error: error instanceof Error ? error.message : "Unknown error",
          ...(normalizedComment !== undefined ? { comment: normalizedComment } : {}),
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async updateGroupStatus(name: string, dto: UpdateGroupStatusDto, request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const normalizedName = this.normalizeSingleGroupName(name, locale);

    try {
      const instances = await this.loadManagedInstances(locale);
      const snapshots = await this.prepareSnapshots(instances, locale);
      const resolution = this.resolveExistingGroups(snapshots, normalizedName, locale);

      this.throwIfPrecheckFailed(resolution.failures);

      const response = await this.applyAcrossInstances(instances, locale, async (instance) => {
        const currentGroup = resolution.groupsByInstanceId.get(instance.id);

        if (!currentGroup) {
          throw new BadRequestException(translateApi(locale, "groups.notFound", { name: normalizedName }));
        }

        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          const result = await this.pihole.setGroupEnabled(
            connection,
            session,
            {
              name: currentGroup.name,
              comment: currentGroup.comment,
            },
            dto.enabled,
          );

          this.assertMutationSucceeded(result);
        });
      });

      await this.audit.record({
        action: "groups.toggle",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedName,
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          enabled: dto.enabled,
          status: response.status,
          summary: response.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.toggle",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedName,
        result: "FAILURE",
        details: {
          enabled: dto.enabled,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async deleteGroup(name: string, request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const normalizedName = this.normalizeSingleGroupName(name, locale);

    try {
      const instances = await this.loadManagedInstances(locale);
      const snapshots = await this.prepareSnapshots(instances, locale);
      const resolution = this.resolveExistingGroups(snapshots, normalizedName, locale);

      this.throwIfPrecheckFailed(resolution.failures);

      const response = await this.applyAcrossInstances(instances, locale, async (instance) => {
        const currentGroup = resolution.groupsByInstanceId.get(instance.id);

        if (!currentGroup) {
          throw new BadRequestException(translateApi(locale, "groups.notFound", { name: normalizedName }));
        }

        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          await this.pihole.deleteGroup(connection, session, currentGroup.name);
        });
      });

      await this.audit.record({
        action: "groups.delete",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedName,
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          status: response.status,
          summary: response.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.delete",
        actorType: "session",
        ipAddress,
        targetType: "group",
        targetId: normalizedName,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async batchDeleteGroups(dto: BatchDeleteGroupsDto, request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const normalizedItems = this.normalizeBatchDeleteItems(dto.items, locale);

    try {
      const instances = await this.loadManagedInstances(locale);
      const snapshots = await this.prepareSnapshots(instances, locale);
      const resolution = this.resolveBatchDeleteTargets(snapshots, normalizedItems, locale);

      this.throwIfPrecheckFailed(resolution.failures);

      const response = await this.applyAcrossInstances(instances, locale, async (instance) => {
        const names = resolution.namesByInstanceId.get(instance.id) ?? [];

        if (names.length === 0) {
          throw new BadRequestException(translateApi(locale, "groups.emptySelection"));
        }

        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          const result = await this.pihole.batchDeleteGroups(connection, session, names);
          this.assertMutationSucceeded(result);
        });
      });

      await this.audit.record({
        action: "groups.batchDelete",
        actorType: "session",
        ipAddress,
        targetType: "group",
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          count: normalizedItems.length,
          items: normalizedItems,
          status: response.status,
          summary: response.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.batchDelete",
        actorType: "session",
        ipAddress,
        targetType: "group",
        result: "FAILURE",
        details: {
          count: normalizedItems.length,
          items: normalizedItems,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async syncGroups(request: Request): Promise<GroupsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    try {
      const instances = await this.loadManagedInstances(locale);
      const baselineInstance = instances.find((instance) => instance.isBaseline);

      if (!baselineInstance) {
        throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
      }

      const snapshots = await this.prepareSnapshots(instances, locale);
      const baselineSnapshot = snapshots.find((snapshot) => snapshot.instance.id === baselineInstance.id);

      if (!baselineSnapshot) {
        throw new BadGatewayException(translateApi(locale, "session.baselineMissing"));
      }

      const successfulInstances: GroupsMutationInstanceSource[] = [this.toSourceSummary(baselineInstance)];
      const failedInstances: GroupsMutationInstanceFailure[] = [];

      for (const snapshot of snapshots) {
        if (snapshot.instance.id === baselineInstance.id) {
          continue;
        }

        try {
          await this.syncSnapshotToBaseline(snapshot, baselineSnapshot, locale);
          successfulInstances.push(this.toSourceSummary(snapshot.instance));
        } catch (error) {
          failedInstances.push(this.mapInstanceFailure(snapshot.instance, error, locale));
        }
      }

      const response: GroupsMutationResponse = {
        status: failedInstances.length > 0 ? "partial" : "success",
        summary: {
          totalInstances: instances.length,
          successfulCount: successfulInstances.length,
          failedCount: failedInstances.length,
        },
        successfulInstances,
        failedInstances,
      };

      await this.audit.record({
        action: "groups.sync",
        actorType: "session",
        ipAddress,
        targetType: "group",
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          status: response.status,
          summary: response.summary,
          sourceBaselineId: baselineInstance.id,
          sourceBaselineName: baselineInstance.name,
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "groups.sync",
        actorType: "session",
        ipAddress,
        targetType: "group",
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  private async loadManagedInstances(locale: ReturnType<typeof getRequestLocale>): Promise<ManagedInstanceRecord[]> {
    const instances = await this.prisma.instance.findMany({
      orderBy: [{ isBaseline: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
        isBaseline: true,
      },
    });

    if (instances.length === 0) {
      throw new BadRequestException(translateApi(locale, "groups.noInstances"));
    }

    return instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      isBaseline: instance.isBaseline,
    }));
  }

  private async loadBaselineInstance(locale: ReturnType<typeof getRequestLocale>): Promise<ManagedInstanceRecord> {
    const baseline = await this.prisma.instance.findFirst({
      where: {
        isBaseline: true,
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        isBaseline: true,
      },
    });

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    return {
      id: baseline.id,
      name: baseline.name,
      baseUrl: baseline.baseUrl,
      isBaseline: baseline.isBaseline,
    };
  }

  private parseRequestedNames(rawValue: string, locale: ReturnType<typeof getRequestLocale>) {
    const result = parseGroupNamesInput(rawValue);

    if (result.error !== null || result.names.length === 0) {
      throw new BadRequestException(translateApi(locale, "groups.invalidNames"));
    }

    return result.names;
  }

  private normalizeSingleGroupName(name: string, locale: ReturnType<typeof getRequestLocale>) {
    const normalizedName = name.trim();

    if (normalizedName.length === 0) {
      throw new BadRequestException(translateApi(locale, "groups.invalidNames"));
    }

    return normalizedName;
  }

  private normalizeBatchDeleteItems(items: string[], locale: ReturnType<typeof getRequestLocale>) {
    const normalizedItems = [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];

    if (normalizedItems.length === 0) {
      throw new BadRequestException(translateApi(locale, "groups.emptySelection"));
    }

    return normalizedItems;
  }

  private normalizeComment(comment: string | undefined) {
    if (comment === undefined) {
      return undefined;
    }

    return comment.trim();
  }

  private async prepareSnapshots(
    instances: ManagedInstanceRecord[],
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InstanceGroupsSnapshot[]> {
    const settled = await Promise.allSettled(instances.map((instance) => this.readGroupsSnapshot(instance, locale)));
    const snapshots: InstanceGroupsSnapshot[] = [];
    const failures: GroupsMutationInstanceFailure[] = [];

    settled.forEach((result, index) => {
      const instance = instances[index];

      if (!instance) {
        return;
      }

      if (result.status === "fulfilled") {
        snapshots.push(result.value);
        return;
      }

      failures.push(this.mapInstanceFailure(instance, result.reason, locale));
    });

    this.throwIfPrecheckFailed(failures);

    return snapshots;
  }

  private async readGroupsSnapshot(
    instance: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InstanceGroupsSnapshot> {
    const result = await this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
      this.pihole.listGroups(connection, session),
    );
    const groupsByName = new Map<string, ManagedGroupRecord>();

    for (const entry of result.groups) {
      const group = this.toManagedGroupRecord(instance, entry, locale);

      if (groupsByName.has(group.name)) {
        throw new BadGatewayException(
          translateApi(locale, "pihole.invalidResponse", {
            baseUrl: instance.baseUrl,
            path: "/groups",
          }),
        );
      }

      groupsByName.set(group.name, group);
    }

    return {
      instance,
      groupsByName,
    };
  }

  private toManagedGroupRecord(
    instance: ManagedInstanceRecord,
    entry: PiholeManagedGroupEntry,
    locale: ReturnType<typeof getRequestLocale>,
  ): ManagedGroupRecord {
    if (entry.name === null || entry.enabled === null || entry.id === null) {
      throw new BadGatewayException(
        translateApi(locale, "pihole.invalidResponse", {
          baseUrl: instance.baseUrl,
          path: "/groups",
        }),
      );
    }

    return {
      name: entry.name,
      comment: entry.comment ?? null,
      enabled: entry.enabled,
      id: entry.id,
      dateAdded: entry.dateAdded,
      dateModified: entry.dateModified,
    };
  }

  private collectCreateFailures(
    snapshots: InstanceGroupsSnapshot[],
    names: string[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const failures: GroupsMutationInstanceFailure[] = [];

    for (const snapshot of snapshots) {
      for (const name of names) {
        if (!snapshot.groupsByName.has(name)) {
          continue;
        }

        failures.push({
          instanceId: snapshot.instance.id,
          instanceName: snapshot.instance.name,
          kind: "pihole_response_error",
          message: translateApi(locale, "groups.alreadyExists", { name }),
        });
      }
    }

    return failures;
  }

  private resolveExistingGroups(
    snapshots: InstanceGroupsSnapshot[],
    name: string,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const groupsByInstanceId = new Map<string, ManagedGroupRecord>();
    const failures: GroupsMutationInstanceFailure[] = [];

    for (const snapshot of snapshots) {
      const group = snapshot.groupsByName.get(name);

      if (!group) {
        failures.push({
          instanceId: snapshot.instance.id,
          instanceName: snapshot.instance.name,
          kind: "pihole_response_error",
          message: translateApi(locale, "groups.notFound", { name }),
        });
        continue;
      }

      if (group.id === 0) {
        failures.push({
          instanceId: snapshot.instance.id,
          instanceName: snapshot.instance.name,
          kind: "pihole_response_error",
          message: translateApi(locale, "groups.defaultImmutable"),
        });
        continue;
      }

      groupsByInstanceId.set(snapshot.instance.id, group);
    }

    return {
      groupsByInstanceId,
      failures,
    };
  }

  private collectRenameConflicts(
    snapshots: InstanceGroupsSnapshot[],
    currentName: string,
    nextName: string,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (currentName === nextName) {
      return [];
    }

    const failures: GroupsMutationInstanceFailure[] = [];

    for (const snapshot of snapshots) {
      if (!snapshot.groupsByName.has(nextName)) {
        continue;
      }

      failures.push({
        instanceId: snapshot.instance.id,
        instanceName: snapshot.instance.name,
        kind: "pihole_response_error",
        message: translateApi(locale, "groups.alreadyExists", { name: nextName }),
      });
    }

    return failures;
  }

  private resolveBatchDeleteTargets(
    snapshots: InstanceGroupsSnapshot[],
    names: string[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const namesByInstanceId = new Map<string, string[]>();
    const failures: GroupsMutationInstanceFailure[] = [];

    for (const snapshot of snapshots) {
      const instanceNames: string[] = [];

      for (const name of names) {
        const group = snapshot.groupsByName.get(name);

        if (!group) {
          failures.push({
            instanceId: snapshot.instance.id,
            instanceName: snapshot.instance.name,
            kind: "pihole_response_error",
            message: translateApi(locale, "groups.notFound", { name }),
          });
          continue;
        }

        if (group.id === 0) {
          failures.push({
            instanceId: snapshot.instance.id,
            instanceName: snapshot.instance.name,
            kind: "pihole_response_error",
            message: translateApi(locale, "groups.defaultImmutable"),
          });
          continue;
        }

        instanceNames.push(group.name);
      }

      namesByInstanceId.set(snapshot.instance.id, instanceNames);
    }

    return {
      namesByInstanceId,
      failures,
    };
  }

  private async syncSnapshotToBaseline(
    targetSnapshot: InstanceGroupsSnapshot,
    baselineSnapshot: InstanceGroupsSnapshot,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const plan = this.buildSyncPlan(targetSnapshot, baselineSnapshot);

    if (plan.create.length === 0 && plan.update.length === 0 && plan.delete.length === 0) {
      return;
    }

    await this.instanceSessions.withActiveSession(
      targetSnapshot.instance.id,
      locale,
      async ({ connection, session }) => {
        if (plan.delete.length === 1) {
          await this.pihole.deleteGroup(connection, session, plan.delete[0] ?? "");
        } else if (plan.delete.length > 1) {
          const deleteResult = await this.pihole.batchDeleteGroups(connection, session, plan.delete);
          this.assertMutationSucceeded(deleteResult);
        }

        for (const group of plan.create) {
          const createResult = await this.pihole.createGroups(connection, session, {
            names: [group.name],
            comment: group.comment ?? undefined,
            enabled: group.enabled,
          });
          this.assertMutationSucceeded(createResult);
        }

        for (const group of plan.update) {
          const updateResult = await this.pihole.updateGroup(connection, session, group.name, {
            name: group.name,
            comment: group.comment,
            enabled: group.enabled,
          });
          this.assertMutationSucceeded(updateResult);
        }
      },
    );
  }

  private buildSyncPlan(
    targetSnapshot: InstanceGroupsSnapshot,
    baselineSnapshot: InstanceGroupsSnapshot,
  ): GroupSyncPlan {
    const create: ManagedGroupRecord[] = [];
    const update: ManagedGroupRecord[] = [];
    const deleteNames: string[] = [];

    for (const baselineGroup of baselineSnapshot.groupsByName.values()) {
      if (isImmutableGroup(baselineGroup)) {
        continue;
      }

      const targetGroup = targetSnapshot.groupsByName.get(baselineGroup.name);

      if (!targetGroup) {
        create.push(baselineGroup);
        continue;
      }

      if (!this.groupsMatch(baselineGroup, targetGroup)) {
        update.push(baselineGroup);
      }
    }

    for (const targetGroup of targetSnapshot.groupsByName.values()) {
      if (isImmutableGroup(targetGroup)) {
        continue;
      }

      if (!baselineSnapshot.groupsByName.has(targetGroup.name)) {
        deleteNames.push(targetGroup.name);
      }
    }

    return {
      create: sortGroupItems(create),
      update: sortGroupItems(update),
      delete: deleteNames.sort((left, right) => left.localeCompare(right)),
    };
  }

  private groupsMatch(left: ManagedGroupRecord, right: ManagedGroupRecord) {
    return left.name === right.name && (left.comment ?? "") === (right.comment ?? "") && left.enabled === right.enabled;
  }

  private async applyAcrossInstances(
    instances: ManagedInstanceRecord[],
    locale: ReturnType<typeof getRequestLocale>,
    execute: (instance: ManagedInstanceRecord) => Promise<void>,
  ): Promise<GroupsMutationResponse> {
    const successfulInstances: GroupsMutationInstanceSource[] = [];
    const failedInstances: GroupsMutationInstanceFailure[] = [];
    const nonBaselineInstances = instances.filter((instance) => !instance.isBaseline);
    const baselineInstance = instances.find((instance) => instance.isBaseline) ?? null;

    for (const instance of nonBaselineInstances) {
      try {
        await execute(instance);
        successfulInstances.push(this.toSourceSummary(instance));
      } catch (error) {
        failedInstances.push(this.mapInstanceFailure(instance, error, locale));
      }
    }

    if (baselineInstance) {
      if (failedInstances.length > 0) {
        failedInstances.push({
          instanceId: baselineInstance.id,
          instanceName: baselineInstance.name,
          kind: "unknown",
          message: translateApi(locale, "groups.baselineSkippedAfterFailure"),
        });
      } else {
        try {
          await execute(baselineInstance);
          successfulInstances.push(this.toSourceSummary(baselineInstance));
        } catch (error) {
          failedInstances.push(this.mapInstanceFailure(baselineInstance, error, locale));
        }
      }
    }

    return {
      status: failedInstances.length > 0 ? "partial" : "success",
      summary: {
        totalInstances: instances.length,
        successfulCount: successfulInstances.length,
        failedCount: failedInstances.length,
      },
      successfulInstances,
      failedInstances,
    };
  }

  private assertMutationSucceeded(result: PiholeGroupMutationResult) {
    const firstError = result.processed.errors.find(
      (item) => (item.message?.trim().length ?? 0) > 0 || (item.item?.trim().length ?? 0) > 0,
    );

    if (!firstError) {
      return;
    }

    throw new PiholeRequestError(
      502,
      firstError.message ?? firstError.item ?? "Pi-hole rejected the group operation.",
      "pihole_response_error",
      result,
    );
  }

  private throwIfPrecheckFailed(failures: GroupsMutationInstanceFailure[]) {
    if (failures.length === 0) {
      return;
    }

    const messages = failures.map((failure) => `${failure.instanceName}: ${failure.message}`);
    throw new BadRequestException(messages.join("\n"));
  }

  private toSourceSummary(instance: ManagedInstanceRecord): GroupsMutationInstanceSource {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
    };
  }

  private mapInstanceFailure(
    instance: ManagedInstanceRecord,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): GroupsMutationInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        ...this.toSourceSummary(instance),
        kind: error.kind,
        message: this.resolveFailureMessage(instance, error, locale),
      };
    }

    return {
      ...this.toSourceSummary(instance),
      kind: "unknown",
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private resolveFailureMessage(
    instance: ManagedInstanceRecord,
    error: PiholeRequestError,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (error.kind === "invalid_credentials") {
      return translateApi(locale, "pihole.invalidTechnicalCredentials", {
        baseUrl: instance.baseUrl,
      });
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }

    return this.getFailureFallbackMessage(error.kind, instance.baseUrl, locale);
  }

  private getFailureFallbackMessage(
    kind: PiholeRequestErrorKind,
    baseUrl: string,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    switch (kind) {
      case "timeout":
        return translateApi(locale, "pihole.timeout", { baseUrl });
      case "dns_error":
        return translateApi(locale, "pihole.unresolved", { baseUrl });
      case "connection_refused":
        return translateApi(locale, "pihole.refused", { baseUrl });
      case "tls_error":
        return translateApi(locale, "pihole.tls", { baseUrl });
      case "pihole_response_error":
        return translateApi(locale, "groups.operationRejected", { baseUrl });
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }
}
