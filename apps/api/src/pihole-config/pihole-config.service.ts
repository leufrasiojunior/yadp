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
  PiholeConfigDetailedNode,
  PiholeConfigDetailedResult,
  PiholeConfigDetailedTopic,
  PiholeConfigOption,
  PiholeConfigTopicDescriptor,
  PiholeConfigTopicName,
  PiholeTeleporterExport,
} from "../pihole/pihole.types";
import { PIHOLE_CONFIG_TOPICS } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { CreateConfigIgnoreRuleDto } from "./dto/create-config-ignore-rule.dto";
import type { ExportTeleporterDto } from "./dto/export-teleporter.dto";
import type { GetConfigTopicDto } from "./dto/get-config-topic.dto";
import type { SyncConfigTopicDto } from "./dto/sync-config-topic.dto";
import type { UpdateConfigTopicDto } from "./dto/update-config-topic.dto";
import type {
  ConfigDriftItem,
  ConfigFieldItem,
  ConfigIgnoredField,
  ConfigIgnoreRuleResponse,
  ConfigInstanceFailure,
  ConfigInstanceSummary,
  ConfigMutationResponse,
  ConfigOverviewResponse,
  ConfigSyncStatus,
  ConfigTopicData,
  ConfigTopicResponse,
  ConfigUpdateResponse,
} from "./pihole-config.types";

type ManagedInstanceRecord = ConfigInstanceSummary;

type InstanceTopicSnapshot = {
  instance: ManagedInstanceRecord;
  topics: Partial<Record<PiholeConfigTopicName, ConfigTopicSnapshot>>;
};

type ConfigTopicSnapshot = {
  descriptor: PiholeConfigTopicDescriptor;
  detailed: PiholeConfigDetailedTopic;
  value: unknown;
  fields: ConfigFieldItem[];
};

type PrimitiveArrayDiffResult = {
  operations: Array<{
    elementPath: string;
    add: string[];
    remove: string[];
  }>;
  scalarPatch: Record<string, unknown> | null;
  requiresFullPatch: boolean;
};

type IgnoreRuleRecord = ConfigIgnoredField;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConfigOption(value: unknown): value is PiholeConfigOption {
  return isRecord(value) && isRecord(value.flags);
}

function extractConfigValue(node: PiholeConfigDetailedNode): unknown {
  if (isConfigOption(node)) {
    return node.value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    result[key] = extractConfigValue(value);
  }

  return result;
}

function flattenTopicFields(
  node: PiholeConfigDetailedTopic,
  currentPath: string[] = [],
  result: ConfigFieldItem[] = [],
): ConfigFieldItem[] {
  for (const [key, value] of Object.entries(node)) {
    const nextPath = [...currentPath, key];

    if (isConfigOption(value)) {
      result.push({
        path: nextPath.join("."),
        key,
        groupPath: currentPath.length > 0 ? currentPath.join(".") : null,
        description: value.description,
        allowed: value.allowed,
        type: value.type,
        value: value.value,
        defaultValue: value.default,
        modified: value.modified,
        flags: value.flags,
        isIgnored: false,
        ignoreRuleId: null,
        sync: {
          status: "synced",
          isFullySynced: true,
          sourceInstances: [],
          missingInstances: [],
        },
      });
      continue;
    }

    flattenTopicFields(value, nextPath, result);
  }

  return result;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

function titleFromTopicName(topic: PiholeConfigTopicName) {
  return topic === "webserver" ? "HTTP/API" : topic.toUpperCase();
}

function countEntries(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function diffPrimitiveArrays(currentValues: unknown[], nextValues: unknown[]) {
  const currentSerialized = currentValues.map((value) => JSON.stringify(value));
  const nextSerialized = nextValues.map((value) => JSON.stringify(value));
  const currentCounts = countEntries(currentSerialized);
  const nextCounts = countEntries(nextSerialized);
  const add: string[] = [];
  const remove: string[] = [];

  for (const [value, count] of nextCounts.entries()) {
    const currentCount = currentCounts.get(value) ?? 0;

    for (let index = currentCount; index < count; index += 1) {
      add.push(JSON.parse(value) as string);
    }
  }

  for (const [value, count] of currentCounts.entries()) {
    const nextCount = nextCounts.get(value) ?? 0;

    for (let index = nextCount; index < count; index += 1) {
      remove.push(JSON.parse(value) as string);
    }
  }

  return { add, remove };
}

function isPrimitiveArray(value: unknown): value is Array<string | number | boolean> {
  return Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item));
}

function buildPrimitiveArrayDiff(
  currentValue: unknown,
  nextValue: unknown,
  currentPath: string[] = [],
): PrimitiveArrayDiffResult {
  const operations: PrimitiveArrayDiffResult["operations"] = [];
  let requiresFullPatch = false;

  const visit = (currentNode: unknown, nextNode: unknown, path: string[]) => {
    if (Array.isArray(currentNode) || Array.isArray(nextNode)) {
      if (isPrimitiveArray(currentNode) && isPrimitiveArray(nextNode)) {
        const diff = diffPrimitiveArrays(currentNode, nextNode);

        if (diff.add.length > 0 || diff.remove.length > 0) {
          operations.push({
            elementPath: path.join("/"),
            add: diff.add.map((item) => String(item)),
            remove: diff.remove.map((item) => String(item)),
          });
        }

        return;
      }

      if (stableSerialize(currentNode) !== stableSerialize(nextNode)) {
        requiresFullPatch = true;
      }

      return;
    }

    if (isRecord(currentNode) && isRecord(nextNode)) {
      const keys = new Set([...Object.keys(currentNode), ...Object.keys(nextNode)]);

      for (const key of keys) {
        visit(currentNode[key], nextNode[key], [...path, key]);
      }

      return;
    }
  };

  const stripArrays = (currentNode: unknown, nextNode: unknown): unknown => {
    if (Array.isArray(currentNode) || Array.isArray(nextNode)) {
      return undefined;
    }

    if (isRecord(nextNode)) {
      const result: Record<string, unknown> = {};
      const keys = Object.keys(nextNode);

      for (const key of keys) {
        const stripped = stripArrays(isRecord(currentNode) ? currentNode[key] : undefined, nextNode[key]);

        if (stripped !== undefined) {
          result[key] = stripped;
        }
      }

      return Object.keys(result).length > 0 ? result : undefined;
    }

    if (stableSerialize(currentNode) === stableSerialize(nextNode)) {
      return undefined;
    }

    return nextNode;
  };

  visit(currentValue, nextValue, currentPath);

  return {
    operations,
    scalarPatch: (stripArrays(currentValue, nextValue) as Record<string, unknown> | undefined) ?? null,
    requiresFullPatch,
  };
}

function buildIgnoreRuleKey(topic: PiholeConfigTopicName, fieldPath: string) {
  return `${topic}:${fieldPath}`;
}

@Injectable()
export class PiholeConfigService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getOverview(request: Request): Promise<ConfigOverviewResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances(locale);
    const baseline = this.requireBaseline(instances, locale);
    const ignoredFields = await this.loadIgnoredFields();
    const { snapshots, unavailableInstances } = await this.loadTopicSnapshots(instances, locale);

    return this.buildOverviewResponse(instances, baseline, snapshots, unavailableInstances, ignoredFields);
  }

  async getTopic(topicInput: string, query: GetConfigTopicDto, request: Request): Promise<ConfigTopicResponse> {
    const locale = getRequestLocale(request);
    const topic = this.assertTopic(topicInput);
    const instances = await this.loadManagedInstances(locale);
    const sourceInstance = this.resolveSourceInstance(instances, query.sourceInstanceId, locale);
    const ignoredFields = await this.loadIgnoredFields();

    const sourceTopic = await this.readTopicFromInstance(sourceInstance, topic, locale);
    const syncSnapshot = await this.loadTopicSnapshots(instances, locale);

    const match = syncSnapshot.snapshots.find((snapshot) => snapshot.instance.instanceId === sourceInstance.instanceId)
      ?.topics[topic];

    const snapshot = match ?? sourceTopic;
    const configTopic = this.buildConfigTopicData(
      snapshot.descriptor,
      snapshot,
      syncSnapshot.snapshots,
      syncSnapshot.unavailableInstances,
      ignoredFields,
    );

    return {
      topic: configTopic,
      sourceInstance,
    };
  }

  async updateTopic(topicInput: string, body: UpdateConfigTopicDto, request: Request): Promise<ConfigUpdateResponse> {
    const locale = getRequestLocale(request);
    const topic = this.assertTopic(topicInput);
    const instances = await this.loadManagedInstances(locale);
    const sourceInstance = this.resolveSourceInstance(instances, body.sourceInstanceId, locale);
    const nextTopicValue = this.readTopicPatch(topic, body.config);
    const currentTopic = await this.readTopicFromInstance(sourceInstance, topic, locale);
    const diff = buildPrimitiveArrayDiff(currentTopic.value, nextTopicValue, [topic]);

    await this.instanceSessions.withActiveSession(
      sourceInstance.instanceId,
      locale,
      async ({ connection, session }) => {
        if (!diff.requiresFullPatch) {
          for (const operation of diff.operations) {
            for (const value of operation.remove) {
              await this.pihole.deleteConfigArrayItem(connection, session, operation.elementPath, value);
            }

            for (const value of operation.add) {
              await this.pihole.addConfigArrayItem(connection, session, operation.elementPath, value);
            }
          }

          if (diff.scalarPatch) {
            await this.pihole.patchConfig(connection, session, {
              [topic]: diff.scalarPatch,
            });
          }

          return;
        }

        await this.pihole.patchConfig(connection, session, {
          [topic]: nextTopicValue,
        });
      },
    );

    await this.audit.record({
      action: "config.update",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "config",
      targetId: topic,
      result: "SUCCESS",
      details: {
        topic,
        sourceInstanceId: sourceInstance.instanceId,
        sourceInstanceName: sourceInstance.instanceName,
        config: body.config as Prisma.InputJsonValue,
      },
    });

    return this.getTopic(topic, { sourceInstanceId: sourceInstance.instanceId }, request);
  }

  async syncTopic(topicInput: string, body: SyncConfigTopicDto, request: Request): Promise<ConfigMutationResponse> {
    const locale = getRequestLocale(request);
    const topic = this.assertTopic(topicInput);
    const instances = await this.loadManagedInstances(locale);
    const sourceInstance = this.resolveSourceInstance(instances, body.sourceInstanceId, locale);
    const targetInstances = instances.filter(
      (instance) =>
        body.targetInstanceIds.includes(instance.instanceId) && instance.instanceId !== sourceInstance.instanceId,
    );

    if (targetInstances.length === 0) {
      throw new BadRequestException("At least one target instance is required.");
    }

    const sourceTopic = await this.readTopicFromInstance(sourceInstance, topic, locale);
    const results: ConfigMutationResponse = {
      status: "success",
      summary: {
        totalInstances: targetInstances.length,
        successfulCount: 0,
        failedCount: 0,
      },
      successfulInstances: [],
      failedInstances: [],
    };

    for (const targetInstance of targetInstances) {
      try {
        await this.instanceSessions.withActiveSession(
          targetInstance.instanceId,
          locale,
          async ({ connection, session }) => {
            await this.pihole.patchConfig(connection, session, {
              [topic]: sourceTopic.value,
            });
          },
        );

        results.successfulInstances.push(targetInstance);
        results.summary.successfulCount += 1;
      } catch (error) {
        results.status = "partial";
        results.summary.failedCount += 1;
        results.failedInstances.push({
          ...targetInstance,
          kind: error instanceof PiholeRequestError ? error.kind : "unknown",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.audit.record({
      action: "config.sync",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "config",
      targetId: topic,
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        topic,
        sourceInstanceId: sourceInstance.instanceId,
        targetInstanceIds: targetInstances.map((instance) => instance.instanceId),
        summary: results.summary,
        failedInstances: results.failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  async exportTeleporter(query: ExportTeleporterDto, request: Request): Promise<PiholeTeleporterExport> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances(locale);
    const sourceInstance = this.resolveSourceInstance(instances, query.instanceId, locale);

    return this.instanceSessions.withActiveSession(sourceInstance.instanceId, locale, ({ connection, session }) =>
      this.pihole.exportTeleporter(connection, session),
    );
  }

  async createIgnoreRule(body: CreateConfigIgnoreRuleDto, request: Request): Promise<ConfigIgnoreRuleResponse> {
    const topic = this.assertTopic(body.topic);
    const fieldPath = body.fieldPath.trim();

    if (fieldPath.length === 0) {
      throw new BadRequestException("fieldPath is required.");
    }

    const rule = await this.prisma.configSyncIgnoreRule.upsert({
      where: {
        topic_fieldPath: {
          topic,
          fieldPath,
        },
      },
      update: {},
      create: {
        topic,
        fieldPath,
      },
    });

    await this.audit.record({
      action: "config.ignore.create",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "config-ignore-rule",
      targetId: rule.id,
      result: "SUCCESS",
      details: {
        topic,
        fieldPath,
      },
    });

    return {
      rule: {
        id: rule.id,
        topic,
        fieldPath,
      },
    };
  }

  async deleteIgnoreRule(
    topicInput: string,
    fieldPathInput: string,
    request: Request,
  ): Promise<ConfigIgnoreRuleResponse> {
    const topic = this.assertTopic(topicInput);
    const fieldPath = fieldPathInput.trim();

    if (fieldPath.length === 0) {
      throw new BadRequestException("fieldPath is required.");
    }

    const existingRule = await this.prisma.configSyncIgnoreRule.findUnique({
      where: {
        topic_fieldPath: {
          topic,
          fieldPath,
        },
      },
    });

    if (!existingRule) {
      throw new NotFoundException("Ignore rule not found.");
    }

    await this.prisma.configSyncIgnoreRule.delete({
      where: {
        topic_fieldPath: {
          topic,
          fieldPath,
        },
      },
    });

    await this.audit.record({
      action: "config.ignore.delete",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "config-ignore-rule",
      targetId: existingRule.id,
      result: "SUCCESS",
      details: {
        topic,
        fieldPath,
      },
    });

    return {
      rule: {
        id: existingRule.id,
        topic,
        fieldPath,
      },
    };
  }

  private buildOverviewResponse(
    instances: ManagedInstanceRecord[],
    baseline: ManagedInstanceRecord,
    snapshots: InstanceTopicSnapshot[],
    unavailableInstances: ConfigInstanceFailure[],
    ignoredFields: IgnoreRuleRecord[],
  ): ConfigOverviewResponse {
    const topics = PIHOLE_CONFIG_TOPICS.flatMap((topicName) => {
      const referenceSnapshot =
        snapshots.find((snapshot) => snapshot.instance.instanceId === baseline.instanceId)?.topics[topicName] ??
        snapshots.find((snapshot) => snapshot.topics[topicName])?.topics[topicName];

      if (!referenceSnapshot) {
        return [];
      }

      const descriptor = {
        ...referenceSnapshot.descriptor,
        title: referenceSnapshot.descriptor.title ?? titleFromTopicName(topicName),
      };

      return [this.buildConfigTopicData(descriptor, referenceSnapshot, snapshots, unavailableInstances, ignoredFields)];
    });

    const driftItems: ConfigDriftItem[] = topics.flatMap((topic) =>
      topic.fields
        .filter((field) => field.sync.status !== "synced" && !field.isIgnored)
        .map((field) => ({
          topic: topic.name,
          topicTitle: topic.title,
          fieldPath: field.path,
          fieldKey: field.key,
          groupPath: field.groupPath,
        })),
    );

    return {
      topics,
      driftItems,
      ignoredFields,
      source: {
        baselineInstanceId: baseline.instanceId,
        baselineInstanceName: baseline.instanceName,
        defaultSourceInstanceId: baseline.instanceId,
        defaultSourceInstanceName: baseline.instanceName,
        totalInstances: instances.length,
        availableInstanceCount: snapshots.length,
        unavailableInstanceCount: unavailableInstances.length,
      },
      instances,
      unavailableInstances,
    };
  }

  private buildConfigTopicData(
    descriptor: PiholeConfigTopicDescriptor,
    referenceTopic: ConfigTopicSnapshot,
    snapshots: InstanceTopicSnapshot[],
    unavailableInstances: ConfigInstanceFailure[],
    ignoredFields: IgnoreRuleRecord[],
  ): ConfigTopicData {
    const matchingInstances: ConfigInstanceSummary[] = [];
    const missingInstances: ConfigInstanceSummary[] = [];

    for (const snapshot of snapshots) {
      const topic = snapshot.topics[descriptor.name];

      if (!topic) {
        missingInstances.push(snapshot.instance);
        continue;
      }

      if (stableSerialize(topic.value) === stableSerialize(referenceTopic.value)) {
        matchingInstances.push(snapshot.instance);
      } else {
        missingInstances.push(snapshot.instance);
      }
    }

    const ignoredByKey = new Map(ignoredFields.map((rule) => [buildIgnoreRuleKey(rule.topic, rule.fieldPath), rule]));

    const fields = referenceTopic.fields.map((field) => {
      const matchingFieldInstances: ConfigInstanceSummary[] = [];
      const missingFieldInstances: ConfigInstanceSummary[] = [];
      const ignoreRule = ignoredByKey.get(buildIgnoreRuleKey(descriptor.name, field.path)) ?? null;

      for (const snapshot of snapshots) {
        const topic = snapshot.topics[descriptor.name];
        const candidateField = topic?.fields.find((item) => item.path === field.path);

        if (!candidateField) {
          missingFieldInstances.push(snapshot.instance);
          continue;
        }

        if (stableSerialize(candidateField.value) === stableSerialize(field.value)) {
          matchingFieldInstances.push(snapshot.instance);
        } else {
          missingFieldInstances.push(snapshot.instance);
        }
      }

      const fieldStatus: ConfigSyncStatus = ignoreRule
        ? "synced"
        : unavailableInstances.length > 0
          ? "partial"
          : missingFieldInstances.length > 0
            ? "drifted"
            : "synced";

      return {
        ...field,
        isIgnored: ignoreRule !== null,
        ignoreRuleId: ignoreRule?.id ?? null,
        sync: {
          status: fieldStatus,
          isFullySynced: fieldStatus === "synced",
          sourceInstances: matchingFieldInstances,
          missingInstances: missingFieldInstances,
        },
      };
    });

    const activeFieldDriftCount = fields.filter((field) => field.sync.status !== "synced" && !field.isIgnored).length;
    const status: ConfigSyncStatus =
      unavailableInstances.length > 0 ? "partial" : activeFieldDriftCount > 0 ? "drifted" : "synced";

    return {
      name: descriptor.name,
      title: descriptor.title ?? titleFromTopicName(descriptor.name),
      description: descriptor.description,
      value: referenceTopic.value,
      detailed: referenceTopic.detailed,
      fields,
      sync: {
        status,
        isFullySynced: status === "synced",
        availableInstanceCount: snapshots.length,
        unavailableInstanceCount: unavailableInstances.length,
        sourceInstances: matchingInstances,
        missingInstances,
      },
    };
  }

  private async loadTopicSnapshots(
    instances: ManagedInstanceRecord[],
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<{
    snapshots: InstanceTopicSnapshot[];
    unavailableInstances: ConfigInstanceFailure[];
  }> {
    const snapshots: InstanceTopicSnapshot[] = [];
    const unavailableInstances: ConfigInstanceFailure[] = [];

    const settled = await Promise.allSettled(
      instances.map(async (instance) => ({
        instance,
        result: await this.instanceSessions.withActiveSession(instance.instanceId, locale, ({ connection, session }) =>
          this.pihole.getConfig(connection, session, { detailed: true }),
        ),
      })),
    );

    for (const [index, result] of settled.entries()) {
      const instance = instances[index];

      if (!instance) {
        continue;
      }

      if (result.status === "rejected") {
        unavailableInstances.push({
          ...instance,
          kind: result.reason instanceof PiholeRequestError ? result.reason.kind : "unknown",
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        continue;
      }

      snapshots.push(this.normalizeInstanceTopics(instance, result.value.result));
    }

    return {
      snapshots,
      unavailableInstances,
    };
  }

  private async loadIgnoredFields(): Promise<IgnoreRuleRecord[]> {
    const rules = await this.prisma.configSyncIgnoreRule.findMany({
      orderBy: [{ topic: "asc" }, { fieldPath: "asc" }],
    });

    return rules.map((rule) => ({
      id: rule.id,
      topic: this.assertTopic(rule.topic),
      fieldPath: rule.fieldPath,
    }));
  }

  private normalizeInstanceTopics(
    instance: ManagedInstanceRecord,
    payload: PiholeConfigDetailedResult,
  ): InstanceTopicSnapshot {
    const topics: Partial<Record<PiholeConfigTopicName, ConfigTopicSnapshot>> = {};

    for (const topic of payload.topics) {
      const detailed = payload.config[topic.name];

      if (!detailed) {
        continue;
      }

      topics[topic.name] = {
        descriptor: {
          ...topic,
          title: topic.title ?? titleFromTopicName(topic.name),
        },
        detailed,
        value: extractConfigValue(detailed),
        fields: flattenTopicFields(detailed),
      };
    }

    return {
      instance,
      topics,
    };
  }

  private async readTopicFromInstance(
    instance: ManagedInstanceRecord,
    topic: PiholeConfigTopicName,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<ConfigTopicSnapshot> {
    const result = await this.instanceSessions.withActiveSession(
      instance.instanceId,
      locale,
      ({ connection, session }) => this.pihole.getConfig(connection, session, { topic, detailed: true }),
    );
    const descriptor = result.topics.find((item) => item.name === topic) ?? {
      name: topic,
      title: titleFromTopicName(topic),
      description: null,
    };
    const detailed = result.config[topic];

    if (!detailed) {
      throw new NotFoundException(`Config topic "${topic}" not found.`);
    }

    return {
      descriptor,
      detailed,
      value: extractConfigValue(detailed),
      fields: flattenTopicFields(detailed),
    };
  }

  private readTopicPatch(topic: PiholeConfigTopicName, payload: Record<string, unknown>) {
    const configRoot = isRecord(payload.config) ? payload.config : null;
    const topicValue = configRoot?.[topic];

    if (topicValue === undefined) {
      throw new BadRequestException(`Missing config.${topic} payload.`);
    }

    return topicValue;
  }

  private assertTopic(topicInput: string): PiholeConfigTopicName {
    if (PIHOLE_CONFIG_TOPICS.includes(topicInput as PiholeConfigTopicName)) {
      return topicInput as PiholeConfigTopicName;
    }

    throw new BadRequestException(`Unsupported config topic "${topicInput}".`);
  }

  private resolveSourceInstance(
    instances: ManagedInstanceRecord[],
    sourceInstanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (sourceInstanceId) {
      const source = instances.find((instance) => instance.instanceId === sourceInstanceId);

      if (!source) {
        throw new NotFoundException(translateApi(locale, "instances.notFound"));
      }

      return source;
    }

    return this.requireBaseline(instances, locale);
  }

  private requireBaseline(instances: ManagedInstanceRecord[], locale: ReturnType<typeof getRequestLocale>) {
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    return baseline;
  }

  private async loadManagedInstances(locale: ReturnType<typeof getRequestLocale>): Promise<ManagedInstanceRecord[]> {
    const instances = await this.prisma.instance.findMany({
      where: { syncEnabled: true },
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isBaseline: true,
        syncEnabled: true,
      },
    });

    if (instances.length === 0) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    return instances.map((instance) => ({
      instanceId: instance.id,
      instanceName: instance.name,
      isBaseline: instance.isBaseline,
      syncEnabled: instance.syncEnabled,
    }));
  }
}
