import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeManagedInstanceSummary,
  PiholeQueryListRequest,
  PiholeQueryListResult,
  PiholeQueryLogEntry,
  PiholeQuerySuggestions,
  PiholeQuerySuggestionsResult,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PIHOLE_QUERY_SUGGESTION_KEYS } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { GetQueriesDto } from "./dto/get-queries.dto";
import type { GetQuerySuggestionsDto } from "./dto/get-query-suggestions.dto";
import type {
  QueriesInstanceFailure,
  QueriesInstanceSource,
  QueriesResponse,
  QueryGroupMembershipRefreshResponse,
  QueryGroupOption,
  QuerySuggestionsResponse,
} from "./queries.types";
import { QueryGroupMembershipsService } from "./query-group-memberships.service";
import { isIP } from "node:net";

type QueryResultWithInstance = PiholeQueryLogEntry & QueriesInstanceSource;

type FulfilledInstanceResult<T> = {
  status: "fulfilled";
  instance: PiholeManagedInstanceSummary;
  result: T;
};

type AllowedIpScopedInstanceQueries = {
  instance: PiholeManagedInstanceSummary;
  sourceRecordsTotal: number;
  filteredQueries: QueryResultWithInstance[];
  filteredEarliestTimestamp: number | null;
};

const GROUP_FILTER_BATCH_SIZE = 200;

function sortStrings(values: string[]) {
  return [...values].sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function normalizeGroupIds(value: unknown) {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  return [
    ...new Set(
      values
        .flatMap((entry) => `${entry}`.split(","))
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.max(0, Math.floor(entry))),
    ),
  ];
}

@Injectable()
export class QueriesService {
  private readonly logger = new Logger(QueriesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(QueryGroupMembershipsService) private readonly queryGroupMemberships: QueryGroupMembershipsService,
  ) {}

  async getQueries(query: GetQueriesDto, request: Request): Promise<QueriesResponse> {
    const locale = getRequestLocale(request);
    const startedAt = Date.now();
    const instances = await this.resolveRequestedInstances(query.scope, query.instanceId, locale);

    if (instances.length === 0) {
      return this.buildEmptyQueriesResponse(0, Date.now() - startedAt);
    }

    if (this.shouldUseCachedGroupFiltering(query.groupIds, query.client_ip)) {
      return this.getQueriesWithGroupIds(query, instances, locale, startedAt);
    }

    if (query.scope === "instance") {
      const instance = instances[0];

      if (!instance) {
        return this.buildEmptyQueriesResponse(0, Date.now() - startedAt);
      }

      try {
        const result = await this.loadQueriesForInstance(instance, locale, this.buildDirectQueryRequest(query));
        const queryEntries = result.queries.map((entry) => this.attachInstanceMetadata(instance, entry));
        const clientAliases = await this.loadClientAliasesForQueries(queryEntries);

        return this.buildSingleInstanceQueriesResponse(instance, result, Date.now() - startedAt, clientAliases);
      } catch (error) {
        const failure = this.mapInstanceFailure(instance, error, locale);
        this.logger.warn(`Query log request failed for "${instance.name}" (${instance.id}): ${failure.message}`);
        return this.buildEmptyQueriesResponse(1, Date.now() - startedAt, [failure]);
      }
    }

    const requestedLength = query.start + query.length;
    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          const result = await this.loadQueriesForInstance(
            instance,
            locale,
            this.buildAggregatedQueryRequest(query, requestedLength),
          );

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

    const successful: FulfilledInstanceResult<PiholeQueryListResult>[] = [];
    const failed: QueriesInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successful.push(item);
      } else {
        failed.push(item.failure);
      }
    }

    const allQueries = successful
      .flatMap((item) => item.result.queries.map((entry) => this.attachInstanceMetadata(item.instance, entry)))
      .sort(
        (left, right) =>
          right.time - left.time || right.id - left.id || left.instanceId.localeCompare(right.instanceId),
      );
    const visibleQueries = allQueries.slice(query.start, query.start + query.length);
    const clientAliases = await this.loadClientAliasesForQueries(visibleQueries);
    const queries = visibleQueries.map((entry) => this.serializeQueryRecord(entry, clientAliases));
    const successfulResults = successful.map((item) => item.result);

    return {
      queries,
      cursor: null,
      recordsTotal: successfulResults.reduce((total, item) => total + item.recordsTotal, 0),
      recordsFiltered: successfulResults.reduce((total, item) => total + item.recordsFiltered, 0),
      earliestTimestamp: this.toIsoTimestamp(
        this.minTimestamp(successfulResults.map((item) => item.earliestTimestamp)),
      ),
      earliestTimestampDisk: this.toIsoTimestamp(
        this.minTimestamp(successfulResults.map((item) => item.earliestTimestampDisk)),
      ),
      took: this.toDurationSeconds(Date.now() - startedAt),
      sources: {
        totalInstances: instances.length,
        successfulInstances: successful.map((item) => this.toSourceSummary(item.instance)),
        failedInstances: failed,
      },
    };
  }

  async getQuerySuggestions(query: GetQuerySuggestionsDto, request: Request): Promise<QuerySuggestionsResponse> {
    const locale = getRequestLocale(request);
    const startedAt = Date.now();
    const [instances, groupOptions] = await Promise.all([
      this.resolveRequestedInstances(query.scope, query.instanceId, locale),
      this.queryGroupMemberships.listGroupOptions(),
    ]);

    if (instances.length === 0) {
      return this.buildEmptySuggestionsResponse(0, Date.now() - startedAt, groupOptions);
    }

    if (query.scope === "instance") {
      const instance = instances[0];

      if (!instance) {
        return this.buildEmptySuggestionsResponse(0, Date.now() - startedAt, groupOptions);
      }

      try {
        const result = await this.loadSuggestionsForInstance(instance, locale);
        const suggestions = await this.applyCachedGroupIpSuggestions(result.suggestions, query, [instance]);

        return {
          suggestions: this.finalizeSuggestions(suggestions),
          groupOptions,
          took: this.toDurationSeconds(Date.now() - startedAt),
          sources: {
            totalInstances: 1,
            successfulInstances: [this.toSourceSummary(instance)],
            failedInstances: [],
          },
        };
      } catch (error) {
        const failure = this.mapInstanceFailure(instance, error, locale);
        this.logger.warn(`Query suggestion request failed for "${instance.name}" (${instance.id}): ${failure.message}`);
        return this.buildEmptySuggestionsResponse(1, Date.now() - startedAt, groupOptions, [failure]);
      }
    }

    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          return {
            status: "fulfilled" as const,
            instance,
            result: await this.loadSuggestionsForInstance(instance, locale),
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
    const successful: FulfilledInstanceResult<PiholeQuerySuggestionsResult>[] = [];
    const failed: QueriesInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successful.push(item);
      } else {
        failed.push(item.failure);
      }
    }

    const suggestions = this.createEmptySuggestions();

    for (const item of successful) {
      this.mergeSuggestions(suggestions, item.result.suggestions);
    }

    const scopedSuggestions = await this.applyCachedGroupIpSuggestions(
      suggestions,
      query,
      successful.map((item) => item.instance),
    );

    return {
      suggestions: this.finalizeSuggestions(scopedSuggestions),
      groupOptions,
      took: this.toDurationSeconds(Date.now() - startedAt),
      sources: {
        totalInstances: instances.length,
        successfulInstances: successful.map((item) => this.toSourceSummary(item.instance)),
        failedInstances: failed,
      },
    };
  }

  refreshGroupMemberships(request: Request): Promise<QueryGroupMembershipRefreshResponse> {
    return this.queryGroupMemberships.refreshGroupMemberships(request);
  }

  private async loadQueriesForInstance(
    instance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
    filters: PiholeQueryListRequest,
  ) {
    return this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
      this.pihole.getQueries(connection, session, filters),
    );
  }

  private async loadSuggestionsForInstance(
    instance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    return this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
      this.pihole.getQuerySuggestions(connection, session),
    );
  }

  private buildDirectQueryRequest(query: GetQueriesDto): PiholeQueryListRequest {
    return {
      from: query.from,
      until: query.until,
      length: query.length,
      start: query.start,
      cursor: query.cursor,
      domain: query.domain,
      clientIp: query.client_ip,
      upstream: query.upstream,
      type: query.type,
      status: query.status,
      reply: query.reply,
      dnssec: query.dnssec,
      disk: query.disk,
    };
  }

  private buildGroupFilteredQueryRequest(
    query: GetQueriesDto,
    start: number,
    length: number,
    cursor?: number,
  ): PiholeQueryListRequest {
    return {
      from: query.from,
      until: query.until,
      length,
      start,
      ...(cursor !== undefined ? { cursor } : {}),
      domain: query.domain,
      clientIp: query.client_ip,
      upstream: query.upstream,
      type: query.type,
      status: query.status,
      reply: query.reply,
      dnssec: query.dnssec,
      disk: query.disk,
    };
  }

  private buildAggregatedQueryRequest(query: GetQueriesDto, requestedLength: number): PiholeQueryListRequest {
    return {
      from: query.from,
      until: query.until,
      length: requestedLength,
      start: 0,
      domain: query.domain,
      clientIp: query.client_ip,
      upstream: query.upstream,
      type: query.type,
      status: query.status,
      reply: query.reply,
      dnssec: query.dnssec,
      disk: query.disk,
    };
  }

  private async resolveRequestedInstances(
    scope: GetQueriesDto["scope"] | GetQuerySuggestionsDto["scope"],
    instanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (scope === "instance") {
      if (!instanceId) {
        throw new BadRequestException(translateApi(locale, "queries.instanceIdRequired"));
      }

      return [await this.instanceSessions.getInstanceSummary(instanceId, locale)];
    }

    return this.instanceSessions.listInstanceSummaries();
  }

  private shouldUseCachedGroupFiltering(groupIds: unknown, clientIp: string | undefined) {
    return normalizeGroupIds(groupIds).length > 0 && (clientIp?.trim().length ?? 0) === 0;
  }

  private attachInstanceMetadata(
    instance: PiholeManagedInstanceSummary,
    entry: PiholeQueryLogEntry,
  ): QueryResultWithInstance {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
      ...entry,
    };
  }

  private serializeQueryRecord(
    entry: QueryResultWithInstance,
    clientAliases: Map<string, string>,
  ): QueriesResponse["queries"][number] {
    const clientIp = entry.client?.ip?.trim() ?? "";
    const alias = clientIp.length > 0 ? (clientAliases.get(clientIp) ?? null) : null;

    return {
      instanceId: entry.instanceId,
      instanceName: entry.instanceName,
      id: entry.id,
      time: new Date(entry.time * 1000).toISOString(),
      type: entry.type,
      status: entry.status,
      dnssec: entry.dnssec,
      domain: entry.domain,
      upstream: entry.upstream,
      reply: entry.reply,
      client: entry.client
        ? {
            ...entry.client,
            alias,
          }
        : null,
      listId: entry.listId,
      ede: entry.ede,
      cname: entry.cname,
    };
  }

  private buildSingleInstanceQueriesResponse(
    instance: PiholeManagedInstanceSummary,
    result: PiholeQueryListResult,
    durationMs: number,
    clientAliases: Map<string, string>,
  ): QueriesResponse {
    return {
      queries: result.queries.map((entry) =>
        this.serializeQueryRecord(this.attachInstanceMetadata(instance, entry), clientAliases),
      ),
      cursor: result.cursor,
      recordsTotal: result.recordsTotal,
      recordsFiltered: result.recordsFiltered,
      earliestTimestamp: this.toIsoTimestamp(result.earliestTimestamp),
      earliestTimestampDisk: this.toIsoTimestamp(result.earliestTimestampDisk),
      took: this.toDurationSeconds(durationMs),
      sources: {
        totalInstances: 1,
        successfulInstances: [this.toSourceSummary(instance)],
        failedInstances: [],
      },
    };
  }

  private buildEmptyQueriesResponse(
    totalInstances: number,
    durationMs: number,
    failedInstances: QueriesInstanceFailure[] = [],
  ): QueriesResponse {
    return {
      queries: [],
      cursor: null,
      recordsTotal: 0,
      recordsFiltered: 0,
      earliestTimestamp: null,
      earliestTimestampDisk: null,
      took: this.toDurationSeconds(durationMs),
      sources: {
        totalInstances,
        successfulInstances: [],
        failedInstances,
      },
    };
  }

  private buildEmptySuggestionsResponse(
    totalInstances: number,
    durationMs: number,
    groupOptions: QueryGroupOption[],
    failedInstances: QueriesInstanceFailure[] = [],
  ): QuerySuggestionsResponse {
    return {
      suggestions: this.createEmptySuggestions(),
      groupOptions,
      took: this.toDurationSeconds(durationMs),
      sources: {
        totalInstances,
        successfulInstances: [],
        failedInstances,
      },
    };
  }

  private createEmptySuggestions(): PiholeQuerySuggestions {
    return {
      domain: [],
      client_ip: [],
      client_name: [],
      upstream: [],
      type: [],
      status: [],
      reply: [],
      dnssec: [],
    };
  }

  private finalizeSuggestions(suggestions: PiholeQuerySuggestions): PiholeQuerySuggestions {
    return {
      domain: sortStrings(suggestions.domain),
      client_ip: sortStrings(suggestions.client_ip.filter((value) => isIP(value) !== 0)),
      client_name: sortStrings(suggestions.client_name),
      upstream: sortStrings(suggestions.upstream),
      type: sortStrings(suggestions.type),
      status: sortStrings(suggestions.status),
      reply: sortStrings(suggestions.reply),
      dnssec: sortStrings(suggestions.dnssec),
    };
  }

  private mergeSuggestions(target: PiholeQuerySuggestions, source: PiholeQuerySuggestionsResult["suggestions"]) {
    for (const key of PIHOLE_QUERY_SUGGESTION_KEYS) {
      const values = source[key] ?? [];

      this.mergeSuggestionValues(target[key], values);
    }
  }

  private mergeSuggestionValues(target: string[], values: string[]) {
    for (const value of values) {
      const normalizedValue = value.trim();

      if (normalizedValue.length === 0 || target.includes(normalizedValue)) {
        continue;
      }

      target.push(normalizedValue);
    }
  }

  private async applyCachedGroupIpSuggestions(
    suggestions: PiholeQuerySuggestions,
    query: GetQuerySuggestionsDto,
    instances: PiholeManagedInstanceSummary[],
  ): Promise<PiholeQuerySuggestions> {
    const groupIds = normalizeGroupIds(query.groupIds);

    if (groupIds.length === 0 || instances.length === 0) {
      return suggestions;
    }

    const allowedIpsByInstance = await this.queryGroupMemberships.loadAllowedIpsByInstance(
      groupIds,
      instances.map((instance) => instance.id),
    );
    const clientIps = new Set<string>();

    for (const ips of allowedIpsByInstance.values()) {
      for (const ip of ips) {
        clientIps.add(ip);
      }
    }

    return {
      ...suggestions,
      client_ip: [...clientIps],
    };
  }

  private minTimestamp(values: Array<number | null>) {
    const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (numbers.length === 0) {
      return null;
    }

    return Math.min(...numbers);
  }

  private toIsoTimestamp(value: number | null) {
    return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
  }

  private toDurationSeconds(durationMs: number) {
    return durationMs / 1000;
  }

  private toSourceSummary(instance: PiholeManagedInstanceSummary): QueriesInstanceSource {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
    };
  }

  private filterQueriesByAllowedIps(
    instance: PiholeManagedInstanceSummary,
    queries: PiholeQueryLogEntry[],
    allowedIps: Set<string>,
  ) {
    return queries
      .filter((entry) => {
        const clientIp = entry.client?.ip?.trim() ?? "";
        return clientIp.length > 0 && allowedIps.has(clientIp);
      })
      .map((entry) => this.attachInstanceMetadata(instance, entry));
  }

  private async getQueriesWithGroupIds(
    query: GetQueriesDto,
    instances: PiholeManagedInstanceSummary[],
    locale: ReturnType<typeof getRequestLocale>,
    startedAt: number,
  ): Promise<QueriesResponse> {
    const allowedIpsByInstance = await this.queryGroupMemberships.loadAllowedIpsByInstance(
      normalizeGroupIds(query.groupIds),
      instances.map((instance) => instance.id),
    );
    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          return {
            status: "fulfilled" as const,
            result: await this.loadAllowedIpScopedQueriesForInstance(
              instance,
              locale,
              allowedIpsByInstance.get(instance.id) ?? new Set<string>(),
              (start, length) => this.buildGroupFilteredQueryRequest(query, start, length),
            ),
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            failure: this.mapInstanceFailure(instance, error, locale),
          };
        }
      }),
    );

    const successful: AllowedIpScopedInstanceQueries[] = [];
    const failed: QueriesInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successful.push(item.result);
      } else {
        failed.push(item.failure);
      }
    }

    const filteredQueries = successful
      .flatMap((item) => item.filteredQueries)
      .sort(
        (left, right) =>
          right.time - left.time || right.id - left.id || left.instanceId.localeCompare(right.instanceId),
      );
    const visibleQueries = filteredQueries.slice(query.start, query.start + query.length);
    const clientAliases = await this.loadClientAliasesForQueries(visibleQueries);

    return {
      queries: visibleQueries.map((entry) => this.serializeQueryRecord(entry, clientAliases)),
      cursor: null,
      recordsTotal: successful.reduce((total, item) => total + item.sourceRecordsTotal, 0),
      recordsFiltered: filteredQueries.length,
      earliestTimestamp: this.toIsoTimestamp(
        this.minTimestamp(successful.map((item) => item.filteredEarliestTimestamp)),
      ),
      earliestTimestampDisk: this.toIsoTimestamp(
        this.minTimestamp(successful.map((item) => item.filteredEarliestTimestamp)),
      ),
      took: this.toDurationSeconds(Date.now() - startedAt),
      sources: {
        totalInstances: instances.length,
        successfulInstances: successful.map((item) => this.toSourceSummary(item.instance)),
        failedInstances: failed,
      },
    };
  }

  private async loadAllowedIpScopedQueriesForInstance(
    instance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
    allowedIps: Set<string>,
    buildFilters: (start: number, length: number, cursor?: number) => PiholeQueryListRequest,
  ): Promise<AllowedIpScopedInstanceQueries> {
    if (allowedIps.size === 0) {
      return {
        instance,
        sourceRecordsTotal: 0,
        filteredQueries: [],
        filteredEarliestTimestamp: null,
      };
    }

    const batchSize = Math.max(
      buildFilters(0, GROUP_FILTER_BATCH_SIZE).length ?? GROUP_FILTER_BATCH_SIZE,
      GROUP_FILTER_BATCH_SIZE,
    );
    const batches: PiholeQueryListResult[] = [];
    const seenBatchSignatures = new Set<string>();
    const seenCursors = new Set<number>();
    let start = 0;
    let cursor: number | undefined;

    while (true) {
      const batch = await this.loadQueriesForInstance(instance, locale, buildFilters(start, batchSize, cursor));
      batches.push(batch);

      if (batch.queries.length === 0) {
        break;
      }

      const batchSignature = batch.queries
        .map((entry) => `${entry.id}:${entry.time}:${entry.client?.ip ?? ""}:${entry.domain ?? ""}`)
        .join("|");

      if (seenBatchSignatures.has(batchSignature)) {
        this.logger.warn(
          `Stopping repeated query batch for "${instance.name}" (${instance.id}) while applying cached group filters.`,
        );
        break;
      }

      seenBatchSignatures.add(batchSignature);

      const nextStart = start + batch.queries.length;

      if (batch.queries.length < batchSize) {
        break;
      }

      if (batch.cursor !== null) {
        if (seenCursors.has(batch.cursor)) {
          this.logger.warn(
            `Stopping repeated query cursor for "${instance.name}" (${instance.id}) while applying cached group filters.`,
          );
          break;
        }

        seenCursors.add(batch.cursor);
        cursor = batch.cursor;
        start = nextStart;
        continue;
      }

      start = nextStart;

      if (start >= batch.recordsFiltered) {
        break;
      }
    }

    const filteredQueries = batches.flatMap((batch) =>
      this.filterQueriesByAllowedIps(instance, batch.queries, allowedIps),
    );

    return {
      instance,
      sourceRecordsTotal: batches[0]?.recordsTotal ?? 0,
      filteredQueries,
      filteredEarliestTimestamp: this.minTimestamp(filteredQueries.map((item) => item.time)),
    };
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): QueriesInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: this.resolveFailureMessage(instance, error, locale),
      };
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown",
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private resolveFailureMessage(
    instance: PiholeManagedInstanceSummary,
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
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }

  private async loadClientAliasesForQueries(queries: QueryResultWithInstance[]) {
    const ips = [...new Set(queries.map((entry) => entry.client?.ip?.trim() ?? "").filter((ip) => ip.length > 0))];

    if (ips.length === 0) {
      return new Map<string, string>();
    }

    const items = await this.prisma.clientDevice.findMany({
      where: {
        alias: {
          not: null,
        },
        ips: {
          hasSome: ips,
        },
      },
      select: {
        alias: true,
        ips: true,
      },
    });

    const requestedIps = new Set(ips);
    const aliasByIp = new Map<string, string | null>();

    for (const item of items) {
      const alias = item.alias?.trim() ?? "";

      if (alias.length === 0) {
        continue;
      }

      for (const ip of item.ips) {
        if (!requestedIps.has(ip)) {
          continue;
        }

        const currentAlias = aliasByIp.get(ip);

        if (currentAlias === undefined) {
          aliasByIp.set(ip, alias);
          continue;
        }

        if (currentAlias !== alias) {
          aliasByIp.set(ip, null);
        }
      }
    }

    return new Map(
      [...aliasByIp.entries()].filter((entry): entry is [string, string] => {
        const [, alias] = entry;
        return alias !== null;
      }),
    );
  }
}
