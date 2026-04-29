import { BadRequestException, Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Request } from "express";

import { DEFAULT_API_LOCALE, getRequestLocale } from "../common/i18n/locale";
import { PrismaService } from "../common/prisma/prisma.service";
import { Prisma } from "../common/prisma/prisma-client";
import { NotificationsService } from "../notifications/notifications.service";
import { PiholeService } from "../pihole/pihole.service";
import type {
  PiholeManagedInstanceSummary,
  PiholeQueryListRequest,
  PiholeQueryListResult,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { CreateOverviewHistoryJobDto } from "./dto/create-overview-history-job.dto";
import type { GetOverviewDto } from "./dto/get-overview.dto";
import type { GetOverviewJobsDto } from "./dto/get-overview-jobs.dto";
import type {
  OverviewChartPoint,
  OverviewCoverageWindowItem,
  OverviewFailureKind,
  OverviewInstanceFailure,
  OverviewInstanceSource,
  OverviewJobDeleteResponse,
  OverviewJobKind,
  OverviewJobsResponse,
  OverviewMutationResponse,
  OverviewResponse,
} from "./overview.types";

type OverviewJobRecord = Awaited<ReturnType<PrismaService["overviewHistoryJob"]["findFirstOrThrow"]>>;
type CoverageWindowRecord = Awaited<ReturnType<PrismaService["overviewCoverageWindow"]["findFirstOrThrow"]>>;

type HistoryRange = {
  from: Date;
  until: Date;
};

type CrawlResult = {
  queries: PiholeQueryListResult["queries"];
  totalFetched: number;
  totalInserted: number;
  storedFrom: Date | null;
  storedUntil: Date | null;
};

type CoverageFailure = {
  instance: PiholeManagedInstanceSummary;
  message: string;
};

type RankingRow = {
  value: string | null;
  count: bigint | number;
};

type ChartRow = {
  bucket: Date;
  totalQueries: bigint | number;
  blockedQueries: bigint | number;
  cachedQueries: bigint | number;
  forwardedQueries: bigint | number;
};

type CoverageStatsRow = {
  instanceId: string;
  count: bigint | number;
  earliest: Date | null;
  latest: Date | null;
};

type CoverageWindowState = {
  hasSuccess: boolean;
  hasFailure: boolean;
  latestFailureMessage: string | null;
};

type SummaryRow = {
  totalQueries: bigint | number;
  blockedQueries: bigint | number;
  cachedQueries: bigint | number;
  forwardedQueries: bigint | number;
  uniqueDomains: bigint | number;
  uniqueClients: bigint | number;
};

const HISTORY_RETENTION_DAYS = 30;
const DEFAULT_RANKING_LIMIT = 10;
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_HISTORY_LOOKBACK_DAYS = 7;
const DEFAULT_JOBS_LIMIT = 20;
const DEFAULT_COVERAGE_LIMIT = 100;

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" ? value : 0;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeHistoryRange(from?: number, until?: number): HistoryRange {
  if (from !== undefined && until !== undefined) {
    const normalizedFrom = new Date(from * 1000);
    const normalizedUntil = new Date(until * 1000);

    if (normalizedUntil.getTime() < normalizedFrom.getTime()) {
      throw new BadRequestException('"until" must be greater than or equal to "from".');
    }

    return {
      from: normalizedFrom,
      until: normalizedUntil,
    };
  }

  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const rangeEnd = endOfDay(yesterday);
  const rangeStart = startOfDay(
    new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - (DEFAULT_HISTORY_LOOKBACK_DAYS - 1)),
  );

  return {
    from: rangeStart,
    until: rangeEnd,
  };
}

function buildHistoryExpiry(reference: Date) {
  return new Date(reference.getTime() + HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function stringifyFailure(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

@Injectable()
export class OverviewService implements OnModuleInit {
  private readonly logger = new Logger(OverviewService.name);
  private readonly activeJobKeys = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.markInterruptedJobsAsFailed();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  handleDailyHistoryMaintenance() {
    void this.enqueueAutomaticImport();
    void this.cleanupExpiredHistory();
  }

  async getOverview(query: GetOverviewDto, request: Request): Promise<OverviewResponse> {
    const locale = getRequestLocale(request);
    const scope = await this.resolveScope(query.scope, query.instanceId, locale);
    const range = normalizeHistoryRange(query.from, query.until);
    const filters = this.buildQueryFilters(
      range,
      scope.instances.map((item) => item.id),
    );
    const chartGroupBy = "hour" as const;

    const [summaryRows, chartRows, domainRows, clientRows, upstreamRows, statusRows, coverageStats, coverageWindows] =
      await Promise.all([
        this.loadSummary(filters),
        this.loadChartRows(filters, chartGroupBy),
        this.loadRanking(filters, "domain"),
        this.loadRanking(filters, "clientIp"),
        this.loadRanking(filters, "upstream"),
        this.loadRanking(filters, "status"),
        this.loadCoverageStats(scope.instances, range),
        this.loadCoverageWindows(scope.instances, range),
      ]);

    const summary = summaryRows ?? {
      totalQueries: 0,
      blockedQueries: 0,
      cachedQueries: 0,
      forwardedQueries: 0,
      uniqueDomains: 0,
      uniqueClients: 0,
    };
    const totalQueries = toNumber(summary.totalQueries);
    const blockedQueries = toNumber(summary.blockedQueries);
    const cachedQueries = toNumber(summary.cachedQueries);
    const forwardedQueries = toNumber(summary.forwardedQueries);

    const coverageByInstance = new Map(coverageStats.map((item) => [item.instanceId, item]));
    const coverageStateByInstance = this.buildCoverageStateByInstance(scope.instances, coverageWindows);
    const failedInstances = this.loadFailedInstances(scope.instances, coverageByInstance, coverageStateByInstance);
    const availableInstances = scope.instances
      .filter(
        (instance) =>
          toNumber(coverageByInstance.get(instance.id)?.count) > 0 ||
          coverageStateByInstance.get(instance.id)?.hasSuccess,
      )
      .map((instance) => this.toInstanceSource(instance));
    const totalStoredQueries = coverageStats.reduce((accumulator, item) => accumulator + toNumber(item.count), 0);
    const earliestStoredAt = this.minDate(coverageStats.map((item) => item.earliest));
    const latestStoredAt = this.maxDate(coverageStats.map((item) => item.latest));

    return {
      scope: {
        mode: scope.mode,
        instanceId: scope.instance?.id ?? null,
        instanceName: scope.instance?.name ?? null,
      },
      filters: {
        from: range.from.toISOString(),
        until: range.until.toISOString(),
        groupBy: chartGroupBy,
      },
      summary: {
        totalQueries,
        blockedQueries,
        cachedQueries,
        forwardedQueries,
        uniqueDomains: toNumber(summary.uniqueDomains),
        uniqueClients: toNumber(summary.uniqueClients),
        percentageBlocked: totalQueries > 0 ? (blockedQueries / totalQueries) * 100 : 0,
      },
      charts: {
        queries: {
          groupBy: chartGroupBy,
          points: chartRows.map((row) => this.mapChartRow(row)),
        },
      },
      rankings: {
        domains: this.mapRankingRows(domainRows),
        clients: this.mapRankingRows(clientRows),
        upstreams: this.mapRankingRows(upstreamRows),
        statuses: this.mapRankingRows(statusRows),
      },
      coverage: {
        hasAnyData: totalStoredQueries > 0,
        requestedFrom: range.from.toISOString(),
        requestedUntil: range.until.toISOString(),
        totalStoredQueries,
        earliestStoredAt: toIso(earliestStoredAt),
        latestStoredAt: toIso(latestStoredAt),
        windows: coverageWindows.map((item) => this.mapCoverageWindow(item)),
      },
      sources: {
        totalInstances: scope.instances.length,
        availableInstances,
        failedInstances,
      },
    };
  }

  async listJobs(query: GetOverviewJobsDto): Promise<OverviewJobsResponse> {
    const jobs = await this.prisma.overviewHistoryJob.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: query.limit ?? DEFAULT_JOBS_LIMIT,
    });

    return {
      jobs: jobs.map((job) => this.mapJob(job)),
    };
  }

  async retryJob(jobId: string, request: Request): Promise<OverviewMutationResponse> {
    const locale = getRequestLocale(request);
    const existing = await this.prisma.overviewHistoryJob.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new BadRequestException("Overview job not found.");
    }

    if (existing.status !== "FAILURE" && existing.status !== "PARTIAL") {
      throw new BadRequestException("Only failed or partial jobs can be retried.");
    }

    if (existing.scope === "instance") {
      await this.resolveScope(existing.scope, existing.instanceId ?? undefined, locale);
    }

    const retried = await this.createJob({
      kind: existing.kind,
      scope: existing.scope,
      instanceId: existing.instanceId,
      instanceNameSnapshot: existing.instanceNameSnapshot,
      requestedFrom: existing.requestedFrom,
      requestedUntil: existing.requestedUntil,
      trigger: "user",
      requestedBy: request.ip ?? null,
    });

    this.scheduleJob(retried.id);
    return { job: this.mapJob(retried) };
  }

  async deleteJob(jobId: string): Promise<OverviewJobDeleteResponse> {
    const existing = await this.prisma.overviewHistoryJob.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new BadRequestException("Overview job not found.");
    }

    if (existing.status !== "SUCCESS") {
      throw new BadRequestException("Only successful jobs can be deleted.");
    }

    const deleted = await this.prisma.overviewHistoryJob.delete({
      where: { id: jobId },
    });

    return { job: this.mapJob(deleted) };
  }

  async enqueueManualImport(body: CreateOverviewHistoryJobDto, request: Request): Promise<OverviewMutationResponse> {
    const locale = getRequestLocale(request);
    const scope = await this.resolveScope(body.scope, body.instanceId, locale);
    const range = normalizeHistoryRange(body.from, body.until);
    const job = await this.createJob({
      kind: "MANUAL_IMPORT",
      scope: scope.mode,
      instanceId: scope.instance?.id ?? null,
      instanceNameSnapshot: scope.instance?.name ?? null,
      requestedFrom: range.from,
      requestedUntil: range.until,
      trigger: "user",
      requestedBy: request.ip ?? null,
    });

    this.scheduleJob(job.id);
    return { job: this.mapJob(job) };
  }

  async enqueueManualDelete(body: CreateOverviewHistoryJobDto, request: Request): Promise<OverviewMutationResponse> {
    const locale = getRequestLocale(request);
    const scope = await this.resolveScope(body.scope, body.instanceId, locale);
    const range = normalizeHistoryRange(body.from, body.until);
    const job = await this.createJob({
      kind: "MANUAL_DELETE",
      scope: scope.mode,
      instanceId: scope.instance?.id ?? null,
      instanceNameSnapshot: scope.instance?.name ?? null,
      requestedFrom: range.from,
      requestedUntil: range.until,
      trigger: "user",
      requestedBy: request.ip ?? null,
    });

    this.scheduleJob(job.id);
    return { job: this.mapJob(job) };
  }

  private async enqueueAutomaticImport() {
    const now = new Date();
    const previousDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const range = {
      from: startOfDay(previousDay),
      until: endOfDay(previousDay),
    };
    const existing = await this.prisma.overviewHistoryJob.findFirst({
      where: {
        kind: "AUTOMATIC_IMPORT",
        requestedFrom: range.from,
        requestedUntil: range.until,
        status: {
          in: ["PENDING", "RUNNING"],
        },
      },
    });

    if (existing) {
      this.logger.debug(
        `Skipping automatic overview import for ${range.from.toISOString()} because a job already exists.`,
      );
      return;
    }

    const job = await this.createJob({
      kind: "AUTOMATIC_IMPORT",
      scope: "all",
      instanceId: null,
      instanceNameSnapshot: null,
      requestedFrom: range.from,
      requestedUntil: range.until,
      trigger: "cron",
      requestedBy: null,
    });

    this.scheduleJob(job.id);
  }

  private scheduleJob(jobId: string) {
    setImmediate(() => {
      void this.executeJob(jobId);
    });
  }

  private async executeJob(jobId: string) {
    const job = await this.prisma.overviewHistoryJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== "PENDING") {
      return;
    }

    const key = this.buildJobKey(job);

    if (this.activeJobKeys.has(key)) {
      this.logger.debug(`Skipping overview job ${job.id} because ${key} is already running.`);
      return;
    }

    this.activeJobKeys.add(key);

    try {
      if (job.kind === "MANUAL_DELETE") {
        await this.runDeleteJob(job);
      } else {
        await this.runImportJob(job);
      }
    } catch (error) {
      await this.markJobFailed(job, error);
    } finally {
      this.activeJobKeys.delete(key);
    }
  }

  private async runImportJob(job: OverviewJobRecord) {
    await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    const range = {
      from: job.requestedFrom,
      until: job.requestedUntil,
    };
    const instances = await this.resolveInstancesForJob(job);
    const expiresAt = buildHistoryExpiry(new Date());
    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          const result = await this.crawlAndPersistInstance(instance, range, job.id, expiresAt);
          return {
            status: "fulfilled" as const,
            instance,
            result,
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            instance,
            message: stringifyFailure(error),
          };
        }
      }),
    );

    let insertedCount = 0;
    let fetchedCount = 0;
    const failures: CoverageFailure[] = [];
    const coverageCreates: Prisma.OverviewCoverageWindowCreateManyInput[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        insertedCount += item.result.totalInserted;
        fetchedCount += item.result.totalFetched;
        coverageCreates.push({
          jobId: job.id,
          instanceId: item.instance.id,
          requestedFrom: range.from,
          requestedUntil: range.until,
          storedFrom: item.result.storedFrom,
          storedUntil: item.result.storedUntil,
          rowCount: item.result.totalFetched,
          status: "SUCCESS",
          errorMessage: null,
          expiresAt,
        });
      } else {
        failures.push({
          instance: item.instance,
          message: item.message,
        });
        coverageCreates.push({
          jobId: job.id,
          instanceId: item.instance.id,
          requestedFrom: range.from,
          requestedUntil: range.until,
          storedFrom: null,
          storedUntil: null,
          rowCount: 0,
          status: "FAILURE",
          errorMessage: item.message,
          expiresAt,
        });
      }
    }

    if (coverageCreates.length > 0) {
      await this.prisma.overviewCoverageWindow.createMany({
        data: coverageCreates,
      });
    }

    const finalStatus =
      failures.length === 0 ? "SUCCESS" : failures.length === instances.length ? "FAILURE" : "PARTIAL";
    const summary = {
      totalInstances: instances.length,
      successfulInstances: instances.length - failures.length,
      failedInstances: failures.map((item) => ({
        instanceId: item.instance.id,
        instanceName: item.instance.name,
        message: item.message,
      })),
      fetchedQueries: fetchedCount,
      insertedQueries: insertedCount,
    } satisfies Prisma.InputJsonObject;

    const updated = await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        queryCount: insertedCount,
        coverageCount: coverageCreates.length,
        summary,
        errorMessage:
          failures.length > 0 ? failures.map((item) => `${item.instance.name}: ${item.message}`).join(" | ") : null,
        finishedAt: new Date(),
        expiresAt,
      },
    });

    await this.recordImportNotification(updated, failures);
  }

  private async runDeleteJob(job: OverviewJobRecord) {
    await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    const instances = await this.resolveInstancesForJob(job);
    const result = await this.prisma.$transaction(async (tx) => {
      const historicalQueryDelete = await tx.historicalQuery.deleteMany({
        where: {
          instanceId: {
            in: instances.map((item) => item.id),
          },
          occurredAt: {
            gte: job.requestedFrom,
            lte: job.requestedUntil,
          },
        },
      });
      const coverageDelete = await tx.overviewCoverageWindow.deleteMany({
        where: {
          instanceId: {
            in: instances.map((item) => item.id),
          },
          requestedFrom: {
            lte: job.requestedUntil,
          },
          requestedUntil: {
            gte: job.requestedFrom,
          },
        },
      });

      return {
        historicalQueryDelete,
        coverageDelete,
      };
    });

    const summary = {
      totalInstances: instances.length,
      deletedQueries: result.historicalQueryDelete.count,
      deletedCoverageWindows: result.coverageDelete.count,
    } satisfies Prisma.InputJsonObject;
    const updated = await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        deletedCount: result.historicalQueryDelete.count,
        coverageCount: result.coverageDelete.count,
        summary,
        finishedAt: new Date(),
        expiresAt: buildHistoryExpiry(new Date()),
      },
    });

    await this.recordDeleteNotification(updated);
  }

  private async crawlAndPersistInstance(
    instance: PiholeManagedInstanceSummary,
    range: HistoryRange,
    jobId: string,
    expiresAt: Date,
  ): Promise<CrawlResult> {
    const batchSize = DEFAULT_CHUNK_SIZE;
    const seenBatchSignatures = new Set<string>();
    const allQueries: PiholeQueryListResult["queries"] = [];
    let start = 0;

    while (true) {
      const batch = await this.loadQueriesForInstance(instance, DEFAULT_API_LOCALE, {
        from: Math.floor(range.from.getTime() / 1000),
        until: Math.floor(range.until.getTime() / 1000),
        length: batchSize,
        start,
        disk: true,
      });

      if (batch.queries.length === 0) {
        break;
      }

      const batchSignature = batch.queries
        .map((entry) => `${entry.id}:${entry.time}:${entry.client?.ip ?? ""}:${entry.domain ?? ""}`)
        .join("|");

      if (seenBatchSignatures.has(batchSignature)) {
        this.logger.warn(`Stopping repeated overview batch for "${instance.name}" (${instance.id}).`);
        break;
      }

      seenBatchSignatures.add(batchSignature);
      allQueries.push(...batch.queries);

      const nextStart = start + batch.queries.length;

      if (batch.queries.length < batchSize) {
        break;
      }

      start = nextStart;

      if (start >= batch.recordsFiltered) {
        break;
      }
    }

    let inserted = 0;

    for (let index = 0; index < allQueries.length; index += DEFAULT_CHUNK_SIZE) {
      const chunk = allQueries.slice(index, index + DEFAULT_CHUNK_SIZE);
      const result = await this.prisma.historicalQuery.createMany({
        data: chunk.map((entry) => ({
          jobId,
          instanceId: instance.id,
          instanceNameSnapshot: instance.name,
          sourceId: entry.id,
          occurredAt: new Date(entry.time * 1000),
          domain: entry.domain,
          clientIp: entry.client?.ip ?? null,
          clientName: entry.client?.name ?? null,
          clientAlias: null,
          upstream: entry.upstream,
          queryType: entry.type,
          status: entry.status,
          dnssec: entry.dnssec,
          replyType: entry.reply?.type ?? null,
          replyTime: entry.reply?.time ?? null,
          listId: entry.listId,
          edeCode: entry.ede?.code ?? null,
          edeText: entry.ede?.text ?? null,
          cname: entry.cname,
          expiresAt,
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    const timestamps = allQueries.map((item) => item.time);

    return {
      queries: allQueries,
      totalFetched: allQueries.length,
      totalInserted: inserted,
      storedFrom: timestamps.length > 0 ? new Date(Math.min(...timestamps) * 1000) : null,
      storedUntil: timestamps.length > 0 ? new Date(Math.max(...timestamps) * 1000) : null,
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

  private async cleanupExpiredHistory() {
    const now = new Date();
    const [queriesResult, coverageResult, jobsResult] = await Promise.all([
      this.prisma.historicalQuery.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      }),
      this.prisma.overviewCoverageWindow.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      }),
      this.prisma.overviewHistoryJob.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
          status: {
            in: ["SUCCESS", "PARTIAL", "FAILURE"],
          },
        },
      }),
    ]);

    this.logger.debug(
      `Overview retention cleanup deleted ${queriesResult.count} queries, ${coverageResult.count} coverage rows and ${jobsResult.count} jobs.`,
    );
  }

  private async markInterruptedJobsAsFailed() {
    await this.prisma.overviewHistoryJob.updateMany({
      where: {
        status: {
          in: ["PENDING", "RUNNING"],
        },
      },
      data: {
        status: "FAILURE",
        errorMessage: "Interrupted by application restart.",
        finishedAt: new Date(),
        expiresAt: buildHistoryExpiry(new Date()),
      },
    });
  }

  private async loadSummary(whereClause: Prisma.Sql) {
    const [row] = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "totalQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%GRAVITY%' OR UPPER(COALESCE("status", '')) LIKE '%DENY%' OR UPPER(COALESCE("status", '')) LIKE '%BLOCK%')::bigint AS "blockedQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%CACHE%')::bigint AS "cachedQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%FORWARDED%')::bigint AS "forwardedQueries",
        COUNT(DISTINCT "domain")::bigint AS "uniqueDomains",
        COUNT(DISTINCT "clientIp")::bigint AS "uniqueClients"
      FROM "HistoricalQuery"
      WHERE ${whereClause}
    `);

    return row ?? null;
  }

  private async loadChartRows(whereClause: Prisma.Sql, groupBy: OverviewGroupBy) {
    const truncation = groupBy === "day" ? Prisma.raw("'day'") : Prisma.raw("'hour'");

    return this.prisma.$queryRaw<ChartRow[]>(Prisma.sql`
      SELECT
        date_trunc(${truncation}, "occurredAt") AS "bucket",
        COUNT(*)::bigint AS "totalQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%GRAVITY%' OR UPPER(COALESCE("status", '')) LIKE '%DENY%' OR UPPER(COALESCE("status", '')) LIKE '%BLOCK%')::bigint AS "blockedQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%CACHE%')::bigint AS "cachedQueries",
        COUNT(*) FILTER (WHERE UPPER(COALESCE("status", '')) LIKE '%FORWARDED%')::bigint AS "forwardedQueries"
      FROM "HistoricalQuery"
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
  }

  private async loadRanking(whereClause: Prisma.Sql, field: "domain" | "clientIp" | "upstream" | "status") {
    const column = Prisma.raw(`"${field}"`);

    return this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      SELECT ${column} AS "value", COUNT(*)::bigint AS "count"
      FROM "HistoricalQuery"
      WHERE ${whereClause} AND ${column} IS NOT NULL AND ${column} <> ''
      GROUP BY ${column}
      ORDER BY "count" DESC, "value" ASC
      LIMIT ${DEFAULT_RANKING_LIMIT}
    `);
  }

  private async loadCoverageStats(instances: PiholeManagedInstanceSummary[], range: HistoryRange) {
    if (instances.length === 0) {
      return [];
    }

    return this.prisma.historicalQuery
      .groupBy({
        by: ["instanceId"],
        where: {
          instanceId: {
            in: instances.map((item) => item.id),
          },
          occurredAt: {
            gte: range.from,
            lte: range.until,
          },
        },
        _count: {
          _all: true,
        },
        _min: {
          occurredAt: true,
        },
        _max: {
          occurredAt: true,
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          instanceId: row.instanceId,
          count: row._count._all,
          earliest: row._min.occurredAt,
          latest: row._max.occurredAt,
        })),
      );
  }

  private async loadCoverageWindows(instances: PiholeManagedInstanceSummary[], range: HistoryRange) {
    if (instances.length === 0) {
      return [];
    }

    return this.prisma.overviewCoverageWindow.findMany({
      where: {
        instanceId: {
          in: instances.map((item) => item.id),
        },
        requestedFrom: {
          lte: range.until,
        },
        requestedUntil: {
          gte: range.from,
        },
      },
      include: {
        instance: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ requestedFrom: "desc" }, { createdAt: "desc" }],
      take: DEFAULT_COVERAGE_LIMIT,
    });
  }

  private buildCoverageStateByInstance(
    instances: PiholeManagedInstanceSummary[],
    coverageWindows: CoverageWindowRecord[],
  ): Map<string, CoverageWindowState> {
    const stateByInstance = new Map<string, CoverageWindowState>();

    for (const instance of instances) {
      stateByInstance.set(instance.id, {
        hasSuccess: false,
        hasFailure: false,
        latestFailureMessage: null,
      });
    }

    for (const window of coverageWindows) {
      const current = stateByInstance.get(window.instanceId);

      if (!current) {
        continue;
      }

      if (window.status === "SUCCESS" || window.status === "PARTIAL") {
        current.hasSuccess = true;
      }

      if (window.status === "FAILURE") {
        current.hasFailure = true;
        if (!current.latestFailureMessage && window.errorMessage) {
          current.latestFailureMessage = window.errorMessage;
        }
      }
    }

    return stateByInstance;
  }

  private loadFailedInstances(
    instances: PiholeManagedInstanceSummary[],
    coverageByInstance: Map<string, CoverageStatsRow>,
    coverageStateByInstance: Map<string, CoverageWindowState>,
  ): OverviewInstanceFailure[] {
    const failures: OverviewInstanceFailure[] = [];

    for (const instance of instances) {
      const hasStoredRows = toNumber(coverageByInstance.get(instance.id)?.count) > 0;
      const coverageState = coverageStateByInstance.get(instance.id);

      if (hasStoredRows || coverageState?.hasSuccess) {
        continue;
      }

      const kind: OverviewFailureKind = coverageState?.hasFailure ? "import_failure" : "missing_data";
      failures.push({
        instanceId: instance.id,
        instanceName: instance.name,
        kind,
        message: kind === "import_failure" ? (coverageState?.latestFailureMessage ?? "") : "",
      });
    }

    return failures;
  }

  private buildQueryFilters(range: HistoryRange, instanceIds?: string[]) {
    const clauses: Prisma.Sql[] = [
      Prisma.sql`"occurredAt" >= ${range.from}`,
      Prisma.sql`"occurredAt" <= ${range.until}`,
    ];

    if (instanceIds && instanceIds.length > 0) {
      clauses.push(Prisma.sql`"instanceId" IN (${Prisma.join(instanceIds)})`);
    }

    const [firstClause, ...restClauses] = clauses;

    if (!firstClause) {
      return Prisma.sql`1 = 1`;
    }

    return restClauses.reduce((accumulator, clause) => Prisma.sql`${accumulator} AND ${clause}`, firstClause);
  }

  private async resolveScope(
    scope: "all" | "instance",
    instanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (scope === "instance") {
      if (!instanceId) {
        throw new BadRequestException('"instanceId" is required when scope="instance".');
      }

      const instance = await this.instanceSessions.getInstanceSummary(instanceId, locale);
      return {
        mode: scope,
        instance,
        instances: [instance],
      };
    }

    const instances = await this.instanceSessions.listInstanceSummaries();
    return {
      mode: scope,
      instance: null,
      instances,
    };
  }

  private async resolveInstancesForJob(job: OverviewJobRecord) {
    if (job.scope === "instance" && job.instanceId) {
      return [await this.instanceSessions.getInstanceSummary(job.instanceId, DEFAULT_API_LOCALE)];
    }

    return this.instanceSessions.listInstanceSummaries();
  }

  private async createJob(input: {
    kind: OverviewJobKind;
    scope: "all" | "instance";
    instanceId: string | null;
    instanceNameSnapshot: string | null;
    requestedFrom: Date;
    requestedUntil: Date;
    trigger: string | null;
    requestedBy: string | null;
  }) {
    return this.prisma.overviewHistoryJob.create({
      data: {
        kind: input.kind,
        scope: input.scope,
        instanceId: input.instanceId,
        instanceNameSnapshot: input.instanceNameSnapshot,
        requestedFrom: input.requestedFrom,
        requestedUntil: input.requestedUntil,
        trigger: input.trigger,
        requestedBy: input.requestedBy,
      },
    });
  }

  private buildJobKey(job: OverviewJobRecord) {
    return [
      job.kind,
      job.scope,
      job.instanceId ?? "all",
      job.requestedFrom.toISOString(),
      job.requestedUntil.toISOString(),
    ].join(":");
  }

  private mapJob(job: OverviewJobRecord) {
    return {
      id: job.id,
      kind: job.kind,
      scope: job.scope as "all" | "instance",
      instanceId: job.instanceId ?? null,
      instanceName: job.instanceNameSnapshot ?? null,
      requestedFrom: job.requestedFrom.toISOString(),
      requestedUntil: job.requestedUntil.toISOString(),
      status: job.status,
      trigger: job.trigger ?? null,
      requestedBy: job.requestedBy ?? null,
      queryCount: job.queryCount,
      deletedCount: job.deletedCount,
      coverageCount: job.coverageCount,
      startedAt: toIso(job.startedAt),
      finishedAt: toIso(job.finishedAt),
      createdAt: job.createdAt.toISOString(),
      errorMessage: job.errorMessage ?? null,
      summary: job.summary,
    };
  }

  private mapCoverageWindow(item: CoverageWindowRecord & { instance: { name: string } }): OverviewCoverageWindowItem {
    return {
      id: item.id,
      jobId: item.jobId,
      instanceId: item.instanceId,
      instanceName: item.instance.name,
      requestedFrom: item.requestedFrom.toISOString(),
      requestedUntil: item.requestedUntil.toISOString(),
      storedFrom: toIso(item.storedFrom),
      storedUntil: toIso(item.storedUntil),
      rowCount: item.rowCount,
      status: item.status,
      errorMessage: item.errorMessage ?? null,
      expiresAt: item.expiresAt.toISOString(),
    };
  }

  private mapChartRow(row: ChartRow): OverviewChartPoint {
    const totalQueries = toNumber(row.totalQueries);
    const blockedQueries = toNumber(row.blockedQueries);

    return {
      timestamp: row.bucket.toISOString(),
      totalQueries,
      blockedQueries,
      cachedQueries: toNumber(row.cachedQueries),
      forwardedQueries: toNumber(row.forwardedQueries),
      percentageBlocked: totalQueries > 0 ? (blockedQueries / totalQueries) * 100 : 0,
    };
  }

  private mapRankingRows(rows: RankingRow[]) {
    return rows.map((row) => ({
      value: row.value ?? "-",
      count: toNumber(row.count),
    }));
  }

  private minDate(values: Array<Date | null>) {
    const filtered = values.filter((value): value is Date => value instanceof Date);
    return filtered.length > 0 ? new Date(Math.min(...filtered.map((item) => item.getTime()))) : null;
  }

  private maxDate(values: Array<Date | null>) {
    const filtered = values.filter((value): value is Date => value instanceof Date);
    return filtered.length > 0 ? new Date(Math.max(...filtered.map((item) => item.getTime()))) : null;
  }

  private toInstanceSource(instance: PiholeManagedInstanceSummary): OverviewInstanceSource {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
    };
  }

  private async recordImportNotification(job: OverviewJobRecord, failures: CoverageFailure[]) {
    const type =
      job.status === "SUCCESS"
        ? "OVERVIEW_IMPORT_SUCCESS"
        : job.status === "PARTIAL"
          ? "OVERVIEW_IMPORT_PARTIAL"
          : "OVERVIEW_IMPORT_FAILURE";
    const trigger = job.kind === "AUTOMATIC_IMPORT" ? "automatic" : "manual";
    const message =
      job.status === "SUCCESS"
        ? "Overview import completed successfully."
        : job.status === "PARTIAL"
          ? "Overview import completed with partial failures."
          : "Overview import failed.";

    await this.notifications.recordSystemEvent({
      type,
      fingerprint: `overview-job:${job.id}`,
      message,
      instanceId: job.instanceId ?? null,
      instanceName: job.instanceNameSnapshot ?? null,
      metadata: {
        url: "/overview",
        jobId: job.id,
        action: "import",
        trigger,
        requestedFrom: job.requestedFrom.toISOString(),
        requestedUntil: job.requestedUntil.toISOString(),
        status: job.status,
        queryCount: job.queryCount,
        failedCount: failures.length,
        errorMessage: job.errorMessage ?? null,
        failures: failures.map((item) => ({
          instanceId: item.instance.id,
          instanceName: item.instance.name,
          message: item.message,
        })),
      } satisfies Prisma.InputJsonObject,
    });
  }

  private async recordDeleteNotification(job: OverviewJobRecord) {
    await this.notifications.recordSystemEvent({
      type: "OVERVIEW_DELETE_SUCCESS",
      fingerprint: `overview-job:${job.id}`,
      message: "Overview historical data deleted successfully.",
      instanceId: job.instanceId ?? null,
      instanceName: job.instanceNameSnapshot ?? null,
      metadata: {
        url: "/overview",
        jobId: job.id,
        action: "delete",
        requestedFrom: job.requestedFrom.toISOString(),
        requestedUntil: job.requestedUntil.toISOString(),
        status: job.status,
        deletedCount: job.deletedCount,
      } satisfies Prisma.InputJsonObject,
    });
  }

  private async markJobFailed(job: OverviewJobRecord, error: unknown) {
    const message = stringifyFailure(error);
    const updated = await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "FAILURE",
        errorMessage: message,
        finishedAt: new Date(),
        expiresAt: buildHistoryExpiry(new Date()),
      },
    });

    await this.notifications.recordSystemEvent({
      type: job.kind === "MANUAL_DELETE" ? "OVERVIEW_DELETE_FAILURE" : "OVERVIEW_IMPORT_FAILURE",
      fingerprint: `overview-job:${job.id}`,
      message: job.kind === "MANUAL_DELETE" ? "Overview historical deletion failed." : "Overview import failed.",
      instanceId: job.instanceId ?? null,
      instanceName: job.instanceNameSnapshot ?? null,
      metadata: {
        url: "/overview",
        jobId: updated.id,
        action: job.kind === "MANUAL_DELETE" ? "delete" : "import",
        trigger: job.kind === "AUTOMATIC_IMPORT" ? "automatic" : "manual",
        requestedFrom: job.requestedFrom.toISOString(),
        requestedUntil: job.requestedUntil.toISOString(),
        status: updated.status,
        errorMessage: message,
      } satisfies Prisma.InputJsonObject,
    });
  }
}
