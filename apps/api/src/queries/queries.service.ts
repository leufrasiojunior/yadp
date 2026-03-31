import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
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
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { GetQueriesDto } from "./dto/get-queries.dto";
import type { GetQuerySuggestionsDto } from "./dto/get-query-suggestions.dto";
import type {
  QueriesInstanceFailure,
  QueriesInstanceSource,
  QueriesResponse,
  QuerySuggestionsResponse,
} from "./queries.types";
import { MAX_QUERY_INSTANCE_CONCURRENCY } from "./queries.types";

type QueryResultWithInstance = PiholeQueryLogEntry & QueriesInstanceSource;

type FulfilledInstanceResult<T> = {
  status: "fulfilled";
  instance: PiholeManagedInstanceSummary;
  result: T;
};

@Injectable()
export class QueriesService {
  private readonly logger = new Logger(QueriesService.name);

  constructor(
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
  ) {}

  async getQueries(query: GetQueriesDto, request: Request): Promise<QueriesResponse> {
    const locale = getRequestLocale(request);
    const startedAt = Date.now();
    const instances = await this.resolveRequestedInstances(query.scope, query.instanceId, locale);

    if (instances.length === 0) {
      return this.buildEmptyQueriesResponse(0, Date.now() - startedAt);
    }

    if (query.scope === "instance") {
      const instance = instances[0];

      if (!instance) {
        return this.buildEmptyQueriesResponse(0, Date.now() - startedAt);
      }

      try {
        const result = await this.loadQueriesForInstance(instance, locale, this.buildDirectQueryRequest(query));

        return this.buildSingleInstanceQueriesResponse(instance, result, Date.now() - startedAt);
      } catch (error) {
        const failure = this.mapInstanceFailure(instance, error, locale);
        this.logger.warn(`Query log request failed for "${instance.name}" (${instance.id}): ${failure.message}`);
        return this.buildEmptyQueriesResponse(1, Date.now() - startedAt, [failure]);
      }
    }

    const requestedLength = query.start + query.length;
    const settled = await this.mapWithConcurrency(instances, MAX_QUERY_INSTANCE_CONCURRENCY, async (instance) => {
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
    });

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
    const queries = allQueries
      .slice(query.start, query.start + query.length)
      .map((entry) => this.serializeQueryRecord(entry));
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
    const instances = await this.resolveRequestedInstances(query.scope, query.instanceId, locale);

    if (instances.length === 0) {
      return this.buildEmptySuggestionsResponse(0, Date.now() - startedAt);
    }

    if (query.scope === "instance") {
      const instance = instances[0];

      if (!instance) {
        return this.buildEmptySuggestionsResponse(0, Date.now() - startedAt);
      }

      try {
        const result = await this.loadSuggestionsForInstance(instance, locale);

        return {
          suggestions: result.suggestions,
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
        return this.buildEmptySuggestionsResponse(1, Date.now() - startedAt, [failure]);
      }
    }

    const settled = await this.mapWithConcurrency(instances, MAX_QUERY_INSTANCE_CONCURRENCY, async (instance) => {
      try {
        const result = await this.loadSuggestionsForInstance(instance, locale);

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
    });
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

    return {
      suggestions,
      took: this.toDurationSeconds(Date.now() - startedAt),
      sources: {
        totalInstances: instances.length,
        successfulInstances: successful.map((item) => this.toSourceSummary(item.instance)),
        failedInstances: failed,
      },
    };
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

  private serializeQueryRecord(entry: QueryResultWithInstance): QueriesResponse["queries"][number] {
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
      client: entry.client,
      listId: entry.listId,
      ede: entry.ede,
      cname: entry.cname,
    };
  }

  private buildSingleInstanceQueriesResponse(
    instance: PiholeManagedInstanceSummary,
    result: PiholeQueryListResult,
    durationMs: number,
  ): QueriesResponse {
    return {
      queries: result.queries.map((entry) => this.serializeQueryRecord(this.attachInstanceMetadata(instance, entry))),
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
    failedInstances: QueriesInstanceFailure[] = [],
  ): QuerySuggestionsResponse {
    return {
      suggestions: this.createEmptySuggestions(),
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

  private mergeSuggestions(target: PiholeQuerySuggestions, source: PiholeQuerySuggestionsResult["suggestions"]) {
    for (const key of Object.keys(target) as Array<keyof PiholeQuerySuggestions>) {
      const values = source[key] ?? [];

      for (const value of values) {
        if (!target[key].includes(value)) {
          target[key].push(value);
        }
      }
    }
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

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    execute: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await execute(items[index] as T, index);
      }
    });

    await Promise.all(workers);

    return results;
  }
}
