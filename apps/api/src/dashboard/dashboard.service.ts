import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";

import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeClientActivitySeries,
  PiholeManagedInstanceSummary,
  PiholeMetricsSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type {
  DashboardInstanceFailure,
  DashboardInstanceMetricsSource,
  DashboardInstanceSourceSummary,
  DashboardOverviewResponse,
} from "./dashboard.types";
import type { GetDashboardOverviewDto } from "./dto/get-dashboard-overview.dto";

type ClientSeriesAccumulator = {
  label: string;
  points: Map<number, number>;
};

type TotalQueriesAccumulator = {
  totalQueries: number;
  cachedQueries: number;
  blockedQueries: number;
  forwardedQueries: number;
};

type MetricsAttemptContext = {
  overviewId: number;
  attemptNumber: number;
};

const DASHBOARD_HISTORY_BUCKET_COUNT = 24;
const DASHBOARD_HISTORY_BUCKET_SECONDS = 60 * 60;
const DASHBOARD_HISTORY_BUCKET_START_MINUTE = 5;
const DASHBOARD_INSTANCE_RETRY_DELAY_MS = 400;

let dashboardOverviewSequence = 0;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
  ) {}

  async getOverview(query: GetDashboardOverviewDto, request: Request): Promise<DashboardOverviewResponse> {
    const locale = getRequestLocale(request);
    const overviewId = ++dashboardOverviewSequence;
    const startedAt = Date.now();
    this.logger.log(
      `[overview:${overviewId}] Loading dashboard overview with scope="${query.scope}" instanceId="${query.instanceId ?? "-"}".`,
    );

    if (query.scope === "instance") {
      if (!query.instanceId) {
        this.logger.warn('Dashboard overview requested with scope="instance" but without instanceId.');
        throw new BadRequestException(translateApi(locale, "dashboard.instanceIdRequired"));
      }

      const instance = await this.instanceSessions.getInstanceSummary(query.instanceId, locale);

      try {
        const source = await this.loadInstanceMetrics(instance, locale, {
          overviewId,
          attemptNumber: 1,
        });

        this.logger.debug(
          `[overview:${overviewId}] Instance dashboard overview finished successfully for "${instance.name}" in ${Date.now() - startedAt}ms.`,
        );

        return this.buildOverview(
          {
            mode: "instance",
            instanceId: instance.id,
            instanceName: instance.name,
          },
          [source],
          [],
          1,
        );
      } catch (error) {
        const failure = this.mapInstanceFailure(instance, error, locale);
        this.logger.error(
          `[overview:${overviewId}] Dashboard overview failed for instance "${failure.instanceName}" (${failure.instanceId}) after ${Date.now() - startedAt}ms: ${failure.message}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new BadGatewayException(`${failure.instanceName}: ${failure.message}`);
      }
    }

    const instances = await this.instanceSessions.listInstanceSummaries();

    if (instances.length === 0) {
      this.logger.warn("Dashboard overview requested before any Pi-hole instance was registered.");
      throw new NotFoundException(translateApi(locale, "dashboard.noInstances"));
    }

    const settled = await Promise.allSettled(
      instances.map((instance) =>
        this.loadInstanceMetrics(instance, locale, {
          overviewId,
          attemptNumber: 1,
        }),
      ),
    );
    const successful: DashboardInstanceMetricsSource[] = [];
    const failed: DashboardInstanceFailure[] = [];

    settled.forEach((result, index) => {
      const instance = instances[index];

      if (!instance) {
        return;
      }

      if (result.status === "fulfilled") {
        successful.push(result.value);
        return;
      }

      failed.push(this.mapInstanceFailure(instance, result.reason, locale));
    });

    if (failed.length > 0) {
      this.logger.warn(
        `[overview:${overviewId}] Dashboard overview completed with partial failures after ${Date.now() - startedAt}ms: ${failed
          .map((item) => `${item.instanceName}=${item.kind}`)
          .join(", ")}`,
      );
    }

    if (successful.length === 0) {
      const details = failed.map((item) => `${item.instanceName}: ${item.message}`).join(" ");
      const message =
        details.length > 0
          ? `${translateApi(locale, "dashboard.allInstancesFailed")} ${details}`
          : translateApi(locale, "dashboard.allInstancesFailed");
      this.logger.error(
        `[overview:${overviewId}] Dashboard overview failed for all instances after ${Date.now() - startedAt}ms. ${details}`,
      );
      throw new BadGatewayException(message);
    }

    this.logger.debug(
      `[overview:${overviewId}] Dashboard overview loaded with ${successful.length} successful instance(s) and ${failed.length} failed instance(s) in ${Date.now() - startedAt}ms.`,
    );

    return this.buildOverview(
      {
        mode: "all",
        instanceId: null,
        instanceName: null,
      },
      successful,
      failed,
      instances.length,
    );
  }

  private async loadInstanceMetrics(
    instance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
    context: MetricsAttemptContext,
  ) {
    this.logger.verbose(
      `[overview:${context.overviewId}] Fetching dashboard metrics for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber}.`,
    );
    try {
      return await this.loadInstanceMetricsOnce(instance, locale, context);
    } catch (error) {
      if (!this.isTransientMetricsError(error)) {
        this.logger.warn(
          `[overview:${context.overviewId}] Non-transient dashboard metrics failure for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber}: ${this.describeDashboardErrorForLog(error)}`,
        );
        throw error;
      }

      this.logger.warn(
        `[overview:${context.overviewId}] Transient dashboard metrics failure for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber}. Retrying once after ${DASHBOARD_INSTANCE_RETRY_DELAY_MS}ms. Details: ${this.describeDashboardErrorForLog(error)}`,
      );
      await this.delay(DASHBOARD_INSTANCE_RETRY_DELAY_MS);
      return this.loadInstanceMetricsOnce(instance, locale, {
        overviewId: context.overviewId,
        attemptNumber: context.attemptNumber + 1,
      });
    }
  }

  private buildOverview(
    scope: DashboardOverviewResponse["scope"],
    sources: DashboardInstanceMetricsSource[],
    failedInstances: DashboardInstanceFailure[],
    totalInstances: number,
  ): DashboardOverviewResponse {
    const summary = sources.reduce<PiholeMetricsSummary>(
      (accumulator, source) => ({
        totalQueries: accumulator.totalQueries + source.summary.totalQueries,
        queriesBlocked: accumulator.queriesBlocked + source.summary.queriesBlocked,
        percentageBlocked: 0,
        domainsOnList: accumulator.domainsOnList + source.summary.domainsOnList,
      }),
      {
        totalQueries: 0,
        queriesBlocked: 0,
        percentageBlocked: 0,
        domainsOnList: 0,
      },
    );

    summary.percentageBlocked = summary.totalQueries > 0 ? (summary.queriesBlocked / summary.totalQueries) * 100 : 0;

    const bucketWindow = this.createHistoryBucketWindow();
    const bucketSet = new Set(bucketWindow);
    const totalQueriesByTimestamp = new Map<number, TotalQueriesAccumulator>(
      bucketWindow.map((bucketTimestamp) => [
        bucketTimestamp,
        {
          totalQueries: 0,
          cachedQueries: 0,
          blockedQueries: 0,
          forwardedQueries: 0,
        },
      ]),
    );

    for (const source of sources) {
      for (const point of source.totalQueries) {
        const bucketTimestamp = this.getHistoryBucketStartTimestamp(point.timestamp);

        if (!bucketSet.has(bucketTimestamp)) {
          continue;
        }

        const current = totalQueriesByTimestamp.get(bucketTimestamp);

        if (!current) {
          continue;
        }

        current.totalQueries += point.totalQueries;
        current.cachedQueries += point.cachedQueries;
        current.blockedQueries += point.blockedQueries;
        current.forwardedQueries += point.forwardedQueries;
      }
    }

    const clientActivity = this.mergeClientActivitySeries(
      sources.map((source) => source.clientActivity),
      bucketWindow,
    );
    this.logger.verbose(
      `Aggregated dashboard response with ${sources.length} source instance(s), ${bucketWindow.length} hourly total-query bucket(s), and ${clientActivity.length} client series.`,
    );

    return {
      scope,
      summary,
      charts: {
        totalQueries: {
          points: Array.from(totalQueriesByTimestamp.entries())
            .map(([timestamp, value]) => ({
              timestamp: this.toIsoTimestamp(timestamp),
              totalQueries: value.totalQueries,
              cachedQueries: value.cachedQueries,
              blockedQueries: value.blockedQueries,
              forwardedQueries: value.forwardedQueries,
              percentageBlocked: value.totalQueries > 0 ? (value.blockedQueries / value.totalQueries) * 100 : 0,
            }))
            .sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
        },
        clientActivity: {
          series: clientActivity,
        },
      },
      sources: {
        totalInstances,
        successfulInstances: sources.map<DashboardInstanceSourceSummary>((source) => ({
          instanceId: source.instance.id,
          instanceName: source.instance.name,
        })),
        failedInstances,
      },
    };
  }

  private mergeClientActivitySeries(groups: PiholeClientActivitySeries[][], bucketWindow: number[]) {
    const merged = new Map<string, ClientSeriesAccumulator>();
    const bucketSet = new Set(bucketWindow);

    for (const seriesGroup of groups) {
      for (const series of seriesGroup) {
        const current = merged.get(series.label) ?? {
          label: series.label,
          points: new Map<number, number>(),
        };

        for (const point of series.points) {
          const bucketTimestamp = this.getHistoryBucketStartTimestamp(point.timestamp);

          if (!bucketSet.has(bucketTimestamp)) {
            continue;
          }

          current.points.set(bucketTimestamp, (current.points.get(bucketTimestamp) ?? 0) + point.queries);
        }

        merged.set(series.label, current);
      }
    }

    return Array.from(merged.values())
      .map((series) => {
        const points = bucketWindow.map((timestamp) => ({
          timestamp: this.toIsoTimestamp(timestamp),
          queries: series.points.get(timestamp) ?? 0,
        }));
        const totalQueries = points.reduce((accumulator, point) => accumulator + point.queries, 0);

        return {
          key: this.createClientSeriesKey(series.label),
          label: series.label,
          totalQueries,
          points,
        };
      })
      .filter((series) => series.totalQueries > 0)
      .sort((left, right) => right.totalQueries - left.totalQueries || left.label.localeCompare(right.label))
      .slice(0, 10);
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): DashboardInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: this.resolvePiholeFailureMessage(instance, error, locale),
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

  private resolvePiholeFailureMessage(
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
      case "pihole_response_error":
        return translateApi(locale, "pihole.unreachable", { baseUrl });
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }

  private createClientSeriesKey(label: string) {
    const normalized = label
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "");

    return normalized.length > 0 ? normalized : "client";
  }

  private toIsoTimestamp(timestamp: number) {
    return new Date(timestamp * 1000).toISOString();
  }

  private async loadInstanceMetricsOnce(
    requestedInstance: PiholeManagedInstanceSummary,
    locale: ReturnType<typeof getRequestLocale>,
    context: MetricsAttemptContext,
  ) {
    const startedAt = Date.now();

    return this.instanceSessions.withActiveSession(
      requestedInstance.id,
      locale,
      async ({ instance, connection, session }) => {
        this.logger.debug(
          `[overview:${context.overviewId}] Instance "${instance.name}" (${instance.id}) session ready attempt=${context.attemptNumber} baseUrl=${instance.baseUrl} connectionBaseUrl=${connection.baseUrl}`,
        );
        const summary = await this.runMetricsStep("stats/summary", instance, context, () =>
          this.pihole.getStatsSummary(connection, session),
        );
        const totalQueries = await this.runMetricsStep("history", instance, context, () =>
          this.pihole.getHistory(connection, session),
        );
        const clientActivity = await this.runMetricsStep("history/clients", instance, context, () =>
          this.pihole.getHistoryClients(connection, session, {
            maxClients: 0,
          }),
        );

        this.logger.debug(
          `[overview:${context.overviewId}] Instance "${instance.name}" (${instance.id}) metrics collected successfully on attempt=${context.attemptNumber} in ${Date.now() - startedAt}ms.`,
        );

        return {
          instance,
          summary,
          totalQueries,
          clientActivity,
        } satisfies DashboardInstanceMetricsSource;
      },
    );
  }

  private async runMetricsStep<T>(
    route: "stats/summary" | "history" | "history/clients",
    instance: PiholeManagedInstanceSummary,
    context: MetricsAttemptContext,
    execute: () => Promise<T>,
  ) {
    const startedAt = Date.now();
    this.logger.verbose(
      `[overview:${context.overviewId}] Route "${route}" start for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber}.`,
    );

    try {
      const result = await execute();
      this.logger.verbose(
        `[overview:${context.overviewId}] Route "${route}" success for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber} durationMs=${Date.now() - startedAt}.`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `[overview:${context.overviewId}] Route "${route}" failed for instance "${instance.name}" (${instance.id}) attempt=${context.attemptNumber} durationMs=${Date.now() - startedAt}. ${this.describeDashboardErrorForLog(error)}`,
      );
      throw error;
    }
  }

  private describeDashboardErrorForLog(error: unknown) {
    if (error instanceof PiholeRequestError) {
      const payload = error.payload;
      const payloadDetails =
        typeof payload === "object" && payload !== null ? ` payload=${JSON.stringify(payload)}` : "";

      return `kind=${error.kind} status=${error.statusCode} message="${error.message}"${payloadDetails}`;
    }

    if (error instanceof Error) {
      return `name=${error.name} message="${error.message}"`;
    }

    return "unknown error";
  }

  private isTransientMetricsError(error: unknown) {
    if (!(error instanceof PiholeRequestError)) {
      return false;
    }

    return (
      error.kind === "timeout" ||
      error.kind === "connection_refused" ||
      error.kind === "dns_error" ||
      error.kind === "unknown"
    );
  }

  private async delay(durationMs: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  private createHistoryBucketWindow(referenceDate = new Date()) {
    const anchorDate = new Date(referenceDate);

    if (anchorDate.getUTCMinutes() < DASHBOARD_HISTORY_BUCKET_START_MINUTE) {
      anchorDate.setUTCHours(anchorDate.getUTCHours() - 1);
    }

    anchorDate.setUTCMinutes(DASHBOARD_HISTORY_BUCKET_START_MINUTE, 0, 0);

    const anchorTimestamp = Math.floor(anchorDate.getTime() / 1000);

    return Array.from({ length: DASHBOARD_HISTORY_BUCKET_COUNT }, (_value, index) => {
      const offset = DASHBOARD_HISTORY_BUCKET_COUNT - index - 1;
      return anchorTimestamp - offset * DASHBOARD_HISTORY_BUCKET_SECONDS;
    });
  }

  private getHistoryBucketStartTimestamp(timestamp: number) {
    const bucketDate = new Date(timestamp * 1000);

    if (bucketDate.getUTCMinutes() < DASHBOARD_HISTORY_BUCKET_START_MINUTE) {
      bucketDate.setUTCHours(bucketDate.getUTCHours() - 1);
    }

    bucketDate.setUTCMinutes(DASHBOARD_HISTORY_BUCKET_START_MINUTE, 0, 0);

    return Math.floor(bucketDate.getTime() / 1000);
  }
}
