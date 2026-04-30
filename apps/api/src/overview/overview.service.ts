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
  OverviewCoverageRenewResponse,
  OverviewCoverageWindowItem,
  OverviewFailureKind,
  OverviewInstanceFailure,
  OverviewInstanceSource,
  OverviewJobDeleteResponse,
  OverviewJobDetailsResponse,
  OverviewJobEvent,
  OverviewJobFailureReason,
  OverviewJobKind,
  OverviewJobProgress,
  OverviewJobStatus,
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

type CoverageFailure = {
  instance: PiholeManagedInstanceSummary;
  message: string;
};

type CoverageRenewTarget = {
  historicalQueryWhere: Prisma.HistoricalQueryWhereInput;
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

type JobRuntimeCheckpoint = {
  instanceId: string | null;
  instanceName: string | null;
  page: number | null;
  start: number | null;
  totalPages: number | null;
  expectedRecords: number | null;
  consecutiveFailures: number;
  lastSuccessfulPage: number;
  updatedAt: string | null;
};

type JobRuntimeInstanceProgress = {
  instanceId: string;
  instanceName: string;
  status: OverviewJobStatus;
  expectedRecords: number | null;
  fetchedRecords: number;
  insertedRecords: number;
  totalPages: number | null;
  completedPages: number;
  currentPage: number | null;
  currentStart: number;
  storedFrom: string | null;
  storedUntil: string | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
  lastFailureReason: OverviewJobFailureReason | null;
  lastSuccessfulAt: string | null;
  updatedAt: string | null;
};

type JobRuntimeEvent = OverviewJobEvent;

type JobRuntimeSummary = {
  version: 1;
  attempts: number;
  totalExpectedRecords: number;
  totalFetchedRecords: number;
  totalInsertedRecords: number;
  totalPages: number;
  completedPages: number;
  checkpoint: JobRuntimeCheckpoint | null;
  lastFailureMessage: string | null;
  lastFailureReason: OverviewJobFailureReason | null;
  instanceProgress: JobRuntimeInstanceProgress[];
  timeline: JobRuntimeEvent[];
};

const HISTORY_RETENTION_DAYS = 30;
const DEFAULT_RANKING_LIMIT = 10;
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_HISTORY_LOOKBACK_DAYS = 7;
const DEFAULT_JOBS_LIMIT = 20;
const DEFAULT_COVERAGE_LIMIT = 100;
const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_DELAY_MS = 60_000;
const COVERAGE_EXPIRING_SOON_DAYS = 5;

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

function daysUntil(value: Date, reference: Date) {
  return Math.ceil((value.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000));
}

function stringifyFailure(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function classifyFailureReason(message: string): OverviewJobFailureReason {
  const normalized = message.toLowerCase();

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("etimedout")) {
    return "timeout";
  }

  if (
    normalized.includes("session") ||
    normalized.includes("csrf") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("401")
  ) {
    return "session";
  }

  if (
    normalized.includes("recordsfiltered") ||
    normalized.includes("count mismatch") ||
    normalized.includes("diverg")
  ) {
    return "count_mismatch";
  }

  if (
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504") ||
    normalized.includes("unavailable") ||
    normalized.includes("network") ||
    normalized.includes("connection")
  ) {
    return "server_unavailable";
  }

  return "unexpected";
}

function buildEmptyRuntimeSummary(): JobRuntimeSummary {
  return {
    version: 1,
    attempts: 0,
    totalExpectedRecords: 0,
    totalFetchedRecords: 0,
    totalInsertedRecords: 0,
    totalPages: 0,
    completedPages: 0,
    checkpoint: null,
    lastFailureMessage: null,
    lastFailureReason: null,
    instanceProgress: [],
    timeline: [],
  };
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

    const [
      summaryRows,
      chartRows,
      domainRows,
      clientRows,
      upstreamRows,
      statusRows,
      coverageStats,
      matchingCoverageWindows,
      savedCoverageWindows,
    ] = await Promise.all([
      this.loadSummary(filters),
      this.loadChartRows(filters, chartGroupBy),
      this.loadRanking(filters, "domain"),
      this.loadRanking(filters, "clientIp"),
      this.loadRanking(filters, "upstream"),
      this.loadRanking(filters, "status"),
      this.loadCoverageStats(scope.instances, range),
      this.loadCoverageWindows(scope.instances, range),
      this.loadSavedCoverageWindows(scope.instances),
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
    const now = new Date();
    const mappedMatchingCoverageWindows = matchingCoverageWindows.map((item) => this.mapCoverageWindow(item, now));
    const mappedSavedCoverageWindows = savedCoverageWindows.map((item) => this.mapCoverageWindow(item, now));
    const expiringCoverageWindows = mappedSavedCoverageWindows.filter((item) => item.isExpiringSoon);

    const coverageByInstance = new Map(coverageStats.map((item) => [item.instanceId, item]));
    const coverageStateByInstance = this.buildCoverageStateByInstance(scope.instances, matchingCoverageWindows);
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
        savedWindowCount: mappedSavedCoverageWindows.length,
        expiringSoonCount: expiringCoverageWindows.length,
        windows: mappedMatchingCoverageWindows,
        savedWindows: mappedSavedCoverageWindows,
        expiringWindows: expiringCoverageWindows,
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

  async getJobDetails(jobId: string): Promise<OverviewJobDetailsResponse> {
    const job = await this.prisma.overviewHistoryJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException("Overview job not found.");
    }

    const mapped = this.mapJob(job);
    const runtime = this.readRuntimeSummary(job.summary);

    return {
      job: {
        ...mapped,
        diagnostics: this.buildJobDiagnostics(runtime),
        timeline: runtime.timeline,
      },
    };
  }

  async renewCoverage(coverageWindowId: string, request: Request): Promise<OverviewCoverageRenewResponse> {
    const existing = await this.prisma.overviewCoverageWindow.findUnique({
      where: { id: coverageWindowId },
      include: {
        instance: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existing) {
      throw new BadRequestException("Overview coverage window not found.");
    }

    if (existing.rowCount <= 0 || (existing.status !== "SUCCESS" && existing.status !== "PARTIAL")) {
      throw new BadRequestException("Only successful or partial coverage windows with stored rows can be renewed.");
    }

    const renewTarget = await this.resolveCoverageRenewTarget(existing);

    const renewedAt = new Date();
    const nextExpiry = buildHistoryExpiry(renewedAt);
    const [renewedQueries, renewedWindow] = await this.prisma.$transaction(async (tx) => {
      const queriesResult = await tx.historicalQuery.updateMany({
        where: renewTarget.historicalQueryWhere,
        data: {
          expiresAt: nextExpiry,
        },
      });

      const coverageWindow = await tx.overviewCoverageWindow.update({
        where: {
          id: existing.id,
        },
        data: {
          expiresAt: nextExpiry,
        },
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      if (existing.jobId) {
        await tx.overviewHistoryJob.update({
          where: { id: existing.jobId },
          data: {
            expiresAt: nextExpiry,
          },
        });
      }

      return [queriesResult.count, coverageWindow] as const;
    });

    await this.recordCoverageRenewalNotification(existing, renewedQueries, nextExpiry, renewedAt, request);

    return {
      coverageWindow: this.mapCoverageWindow(renewedWindow, renewedAt),
      renewedQueryCount: renewedQueries,
      renewedAt: renewedAt.toISOString(),
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

    if (!["FAILURE", "PARTIAL", "PAUSED"].includes(existing.status)) {
      throw new BadRequestException("Only failed, partial, or paused jobs can be retried.");
    }

    if (existing.scope === "instance") {
      await this.resolveScope(existing.scope, existing.instanceId ?? undefined, locale);
    }

    const retried = await this.prisma.overviewHistoryJob.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        trigger: "user",
        requestedBy: request.ip ?? null,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      },
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

    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.historicalQuery.deleteMany({
        where: { jobId },
      });
      await tx.overviewCoverageWindow.deleteMany({
        where: { jobId },
      });

      return tx.overviewHistoryJob.delete({
        where: { id: jobId },
      });
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
    const instances = await this.resolveInstancesForJob(job);
    let runtime = this.prepareRuntimeForExecution(this.readRuntimeSummary(job.summary), instances);

    runtime.attempts += 1;
    runtime = this.pushEvent(runtime, {
      level: "info",
      type: "job_started",
      message: `Job started with ${instances.length} target instance(s).`,
      instanceId: null,
      instanceName: null,
      page: null,
      start: null,
      failureReason: null,
    });
    runtime = this.pushEvent(runtime, {
      level: "info",
      type: "instances_discovered",
      message: `Target instances: ${instances.map((instance) => instance.name).join(", ") || "none"}.`,
      instanceId: null,
      instanceName: null,
      page: null,
      start: null,
      failureReason: null,
    });

    await this.persistJobRuntime(job.id, runtime, {
      status: "RUNNING",
      startedAt: job.startedAt ?? new Date(),
      finishedAt: null,
      errorMessage: null,
      expiresAt: null,
    });

    const range = {
      from: job.requestedFrom,
      until: job.requestedUntil,
    };
    const expiresAt = buildHistoryExpiry(new Date());

    for (const instance of instances) {
      const progress = this.getOrCreateInstanceProgress(runtime, instance);

      if (progress.status === "SUCCESS") {
        continue;
      }

      const outcome = await this.processImportInstance(job, instance, range, expiresAt, runtime);
      runtime = outcome.runtime;

      if (outcome.paused) {
        return;
      }
    }

    runtime = this.recalculateRuntime(runtime);
    runtime.checkpoint = null;
    runtime = this.pushEvent(runtime, {
      level: "info",
      type: "job_completed",
      message: `Job completed with ${runtime.totalInsertedRecords} stored query row(s).`,
      instanceId: null,
      instanceName: null,
      page: null,
      start: null,
      failureReason: null,
    });

    const updated = await this.persistJobRuntime(job.id, runtime, {
      status: "SUCCESS",
      queryCount: runtime.totalInsertedRecords,
      coverageCount: runtime.instanceProgress.length,
      errorMessage: null,
      finishedAt: new Date(),
      expiresAt,
    });

    await this.recordImportNotification(updated, []);
  }

  private async processImportInstance(
    job: OverviewJobRecord,
    instance: PiholeManagedInstanceSummary,
    range: HistoryRange,
    expiresAt: Date,
    initialRuntime: JobRuntimeSummary,
  ) {
    let runtime = initialRuntime;
    let progress = this.getOrCreateInstanceProgress(runtime, instance);
    const seenBatchSignatures = new Set<string>();

    progress.status = "RUNNING";
    progress.updatedAt = new Date().toISOString();
    runtime.checkpoint = this.buildCheckpoint(progress, instance);
    runtime = this.recalculateRuntime(runtime);
    await this.persistJobRuntime(job.id, runtime, {
      status: "RUNNING",
      queryCount: runtime.totalInsertedRecords,
      coverageCount: runtime.instanceProgress.length,
    });
    await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "RUNNING");

    while (true) {
      progress = this.getOrCreateInstanceProgress(runtime, instance);
      const currentPage = Math.floor(progress.currentStart / DEFAULT_CHUNK_SIZE) + 1;

      runtime.checkpoint = this.buildCheckpoint(progress, instance);
      runtime = this.pushEvent(runtime, {
        level: "info",
        type: "page_started",
        message: `Fetching page ${currentPage} for ${instance.name} (start=${progress.currentStart}).`,
        instanceId: instance.id,
        instanceName: instance.name,
        page: currentPage,
        start: progress.currentStart,
        failureReason: null,
      });
      await this.persistJobRuntime(job.id, runtime, {
        status: "RUNNING",
        queryCount: runtime.totalInsertedRecords,
        coverageCount: runtime.instanceProgress.length,
      });

      let batch: PiholeQueryListResult;

      try {
        batch = await this.loadQueriesForInstance(instance, DEFAULT_API_LOCALE, {
          from: Math.floor(range.from.getTime() / 1000),
          until: Math.floor(range.until.getTime() / 1000),
          length: DEFAULT_CHUNK_SIZE,
          start: progress.currentStart,
          disk: true,
        });
      } catch (error) {
        const message = stringifyFailure(error);
        const failureReason = classifyFailureReason(message);

        progress.consecutiveFailures += 1;
        progress.lastErrorMessage = message;
        progress.lastFailureReason = failureReason;
        progress.updatedAt = new Date().toISOString();
        runtime.lastFailureMessage = message;
        runtime.lastFailureReason = failureReason;
        runtime.checkpoint = this.buildCheckpoint(progress, instance);
        runtime = this.pushEvent(runtime, {
          level: "error",
          type: "page_failed",
          message: `${instance.name} failed on page ${currentPage}: ${message}`,
          instanceId: instance.id,
          instanceName: instance.name,
          page: currentPage,
          start: progress.currentStart,
          failureReason,
        });

        await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "RUNNING");

        if (progress.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          progress.status = "PAUSED";
          runtime.checkpoint = this.buildCheckpoint(progress, instance);
          runtime = this.recalculateRuntime(runtime);
          runtime = this.pushEvent(runtime, {
            level: "warn",
            type: "job_paused",
            message: `${instance.name} paused after ${progress.consecutiveFailures} consecutive failures on page ${currentPage}.`,
            instanceId: instance.id,
            instanceName: instance.name,
            page: currentPage,
            start: progress.currentStart,
            failureReason,
          });

          const errorMessage = `${instance.name}: ${message}`;
          const updated = await this.persistJobRuntime(job.id, runtime, {
            status: "PAUSED",
            queryCount: runtime.totalInsertedRecords,
            coverageCount: runtime.instanceProgress.length,
            errorMessage,
            finishedAt: new Date(),
            expiresAt,
          });
          await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "PAUSED");
          await this.recordImportNotification(updated, [
            {
              instance,
              message,
            },
          ]);

          return {
            runtime,
            paused: true,
          };
        }

        runtime = this.pushEvent(runtime, {
          level: "warn",
          type: "retry_scheduled",
          message: `Retry scheduled in 1 minute for ${instance.name} page ${currentPage}.`,
          instanceId: instance.id,
          instanceName: instance.name,
          page: currentPage,
          start: progress.currentStart,
          failureReason,
        });
        runtime = this.recalculateRuntime(runtime);
        await this.persistJobRuntime(job.id, runtime, {
          status: "RUNNING",
          queryCount: runtime.totalInsertedRecords,
          coverageCount: runtime.instanceProgress.length,
          errorMessage: message,
        });
        await this.delay(RETRY_DELAY_MS);
        continue;
      }

      if (progress.expectedRecords === null) {
        progress.expectedRecords = batch.recordsFiltered;
        progress.totalPages = batch.recordsFiltered > 0 ? Math.ceil(batch.recordsFiltered / DEFAULT_CHUNK_SIZE) : 0;
        progress.updatedAt = new Date().toISOString();
        runtime = this.pushEvent(runtime, {
          level: "info",
          type: "instance_totals_discovered",
          message: `${instance.name} reports ${batch.recordsFiltered} record(s) across ${progress.totalPages} page(s).`,
          instanceId: instance.id,
          instanceName: instance.name,
          page: currentPage,
          start: progress.currentStart,
          failureReason: null,
        });
      }

      const batchSignature = batch.queries
        .map((entry) => `${entry.id}:${entry.time}:${entry.client?.ip ?? ""}:${entry.domain ?? ""}`)
        .join("|");

      if (batchSignature.length > 0 && seenBatchSignatures.has(batchSignature)) {
        const message = `Repeated batch detected for ${instance.name} at start=${progress.currentStart}.`;
        progress.consecutiveFailures = MAX_CONSECUTIVE_FAILURES;
        progress.lastErrorMessage = message;
        progress.lastFailureReason = "unexpected";
        progress.status = "PAUSED";
        progress.updatedAt = new Date().toISOString();
        runtime.lastFailureMessage = message;
        runtime.lastFailureReason = "unexpected";
        runtime.checkpoint = this.buildCheckpoint(progress, instance);
        runtime = this.pushEvent(runtime, {
          level: "error",
          type: "job_paused",
          message,
          instanceId: instance.id,
          instanceName: instance.name,
          page: currentPage,
          start: progress.currentStart,
          failureReason: "unexpected",
        });
        runtime = this.recalculateRuntime(runtime);
        const updated = await this.persistJobRuntime(job.id, runtime, {
          status: "PAUSED",
          queryCount: runtime.totalInsertedRecords,
          coverageCount: runtime.instanceProgress.length,
          errorMessage: message,
          finishedAt: new Date(),
          expiresAt,
        });
        await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "PAUSED");
        await this.recordImportNotification(updated, [{ instance, message }]);

        return {
          runtime,
          paused: true,
        };
      }

      if (batchSignature.length > 0) {
        seenBatchSignatures.add(batchSignature);
      }

      let inserted = 0;

      if (batch.queries.length > 0) {
        const result = await this.prisma.historicalQuery.createMany({
          data: batch.queries.map((entry) => ({
            jobId: job.id,
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
        inserted = result.count;
      }

      const timestamps = batch.queries.map((item) => item.time * 1000);
      const storedFrom = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
      const storedUntil = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;

      if (storedFrom && (!progress.storedFrom || storedFrom < progress.storedFrom)) {
        progress.storedFrom = storedFrom;
      }

      if (storedUntil && (!progress.storedUntil || storedUntil > progress.storedUntil)) {
        progress.storedUntil = storedUntil;
      }

      progress.fetchedRecords += batch.queries.length;
      progress.insertedRecords += inserted;
      progress.completedPages += batch.queries.length > 0 || progress.expectedRecords === 0 ? 1 : 0;
      progress.currentPage = currentPage;
      progress.currentStart += batch.queries.length;
      progress.consecutiveFailures = 0;
      progress.lastErrorMessage = null;
      progress.lastFailureReason = null;
      progress.lastSuccessfulAt = new Date().toISOString();
      progress.updatedAt = new Date().toISOString();

      runtime.lastFailureMessage = null;
      runtime.lastFailureReason = null;
      runtime = this.recalculateRuntime(runtime);
      runtime.checkpoint =
        progress.expectedRecords !== null && progress.currentStart >= progress.expectedRecords
          ? null
          : this.buildCheckpoint(progress, instance);
      runtime = this.pushEvent(runtime, {
        level: "info",
        type: "page_saved",
        message: `${instance.name} saved page ${currentPage} with ${batch.queries.length} fetched row(s) and ${inserted} inserted row(s).`,
        instanceId: instance.id,
        instanceName: instance.name,
        page: currentPage,
        start: progress.currentStart - batch.queries.length,
        failureReason: null,
      });

      await this.persistJobRuntime(job.id, runtime, {
        status: "RUNNING",
        queryCount: runtime.totalInsertedRecords,
        coverageCount: runtime.instanceProgress.length,
        errorMessage: null,
      });
      await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "RUNNING");

      if (
        progress.expectedRecords === 0 ||
        progress.currentStart >= progress.expectedRecords ||
        batch.queries.length === 0
      ) {
        break;
      }
    }

    progress = this.getOrCreateInstanceProgress(runtime, instance);

    if (progress.expectedRecords !== progress.fetchedRecords) {
      const message = `${instance.name}: imported ${progress.fetchedRecords} row(s), expected ${progress.expectedRecords ?? 0} from recordsFiltered.`;
      progress.status = "PAUSED";
      progress.lastErrorMessage = message;
      progress.lastFailureReason = "count_mismatch";
      progress.updatedAt = new Date().toISOString();
      runtime.lastFailureMessage = message;
      runtime.lastFailureReason = "count_mismatch";
      runtime.checkpoint = this.buildCheckpoint(progress, instance);
      runtime = this.recalculateRuntime(runtime);
      runtime = this.pushEvent(runtime, {
        level: "error",
        type: "count_mismatch",
        message,
        instanceId: instance.id,
        instanceName: instance.name,
        page: progress.currentPage,
        start: progress.currentStart,
        failureReason: "count_mismatch",
      });

      const updated = await this.persistJobRuntime(job.id, runtime, {
        status: "PAUSED",
        queryCount: runtime.totalInsertedRecords,
        coverageCount: runtime.instanceProgress.length,
        errorMessage: message,
        finishedAt: new Date(),
        expiresAt,
      });
      await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "PAUSED");
      await this.recordImportNotification(updated, [{ instance, message }]);

      return {
        runtime,
        paused: true,
      };
    }

    progress.status = "SUCCESS";
    progress.currentPage = null;
    progress.updatedAt = new Date().toISOString();
    runtime.checkpoint = null;
    runtime = this.recalculateRuntime(runtime);
    runtime = this.pushEvent(runtime, {
      level: "info",
      type: "instance_completed",
      message: `${instance.name} completed with ${progress.fetchedRecords} fetched row(s).`,
      instanceId: instance.id,
      instanceName: instance.name,
      page: null,
      start: null,
      failureReason: null,
    });
    await this.persistJobRuntime(job.id, runtime, {
      status: "RUNNING",
      queryCount: runtime.totalInsertedRecords,
      coverageCount: runtime.instanceProgress.length,
      errorMessage: null,
    });
    await this.upsertCoverageWindow(job.id, instance, range, expiresAt, progress, "SUCCESS");

    return {
      runtime,
      paused: false,
    };
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
      version: 1,
      attempts: 1,
      totalExpectedRecords: 0,
      totalFetchedRecords: 0,
      totalInsertedRecords: 0,
      totalPages: 0,
      completedPages: 0,
      checkpoint: null,
      lastFailureMessage: null,
      lastFailureReason: null,
      instanceProgress: [],
      timeline: [
        {
          at: new Date().toISOString(),
          level: "info",
          type: "job_completed",
          message: `Deleted ${result.historicalQueryDelete.count} historical row(s).`,
          instanceId: null,
          instanceName: null,
          page: null,
          start: null,
          failureReason: null,
        },
      ],
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
            in: ["SUCCESS", "PARTIAL", "FAILURE", "PAUSED"],
          },
        },
      }),
    ]);

    this.logger.debug(
      `Overview retention cleanup deleted ${queriesResult.count} queries, ${coverageResult.count} coverage rows and ${jobsResult.count} jobs.`,
    );
  }

  private async markInterruptedJobsAsFailed() {
    const interruptedJobs = await this.prisma.overviewHistoryJob.findMany({
      where: {
        status: {
          in: ["PENDING", "RUNNING"],
        },
      },
    });

    for (const job of interruptedJobs) {
      let runtime = this.readRuntimeSummary(job.summary);
      runtime.lastFailureMessage = "Interrupted by application restart.";
      runtime.lastFailureReason = "unexpected";
      runtime = this.pushEvent(runtime, {
        level: "error",
        type: "job_interrupted",
        message: "Job interrupted by application restart.",
        instanceId: null,
        instanceName: null,
        page: runtime.checkpoint?.page ?? null,
        start: runtime.checkpoint?.start ?? null,
        failureReason: "unexpected",
      });

      await this.prisma.overviewHistoryJob.update({
        where: { id: job.id },
        data: {
          status: "FAILURE",
          errorMessage: "Interrupted by application restart.",
          summary: this.serializeRuntimeSummary(runtime),
          finishedAt: new Date(),
          expiresAt: buildHistoryExpiry(new Date()),
        },
      });
    }
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

  private async loadChartRows(whereClause: Prisma.Sql, groupBy: "hour" | "day") {
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

  private async loadSavedCoverageWindows(instances: PiholeManagedInstanceSummary[]) {
    if (instances.length === 0) {
      return [];
    }

    return this.prisma.overviewCoverageWindow.findMany({
      where: {
        instanceId: {
          in: instances.map((item) => item.id),
        },
      },
      include: {
        instance: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ expiresAt: "asc" }, { requestedFrom: "desc" }, { createdAt: "desc" }],
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

      if (window.status === "FAILURE" || window.status === "PAUSED") {
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
    const runtime = this.readRuntimeSummary(job.summary);

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
      failureReason: runtime.lastFailureReason,
      progress: this.toJobProgress(runtime),
    };
  }

  private async resolveCoverageRenewTarget(
    coverageWindow: CoverageWindowRecord & { instance: { name: string } },
  ): Promise<CoverageRenewTarget> {
    if (coverageWindow.jobId) {
      return {
        historicalQueryWhere: {
          jobId: coverageWindow.jobId,
          instanceId: coverageWindow.instanceId,
        },
      };
    }

    const overlappingCoverageCount = await this.prisma.overviewCoverageWindow.count({
      where: {
        instanceId: coverageWindow.instanceId,
        requestedFrom: coverageWindow.requestedFrom,
        requestedUntil: coverageWindow.requestedUntil,
      },
    });

    if (overlappingCoverageCount > 1) {
      throw new BadRequestException(
        "Detached coverage window is ambiguous and cannot be renewed safely. Re-import this period instead.",
      );
    }

    throw new BadRequestException(
      "Detached coverage window cannot be renewed safely because it is no longer linked to its source job.",
    );
  }

  private mapCoverageWindow(
    item: CoverageWindowRecord & { instance: { name: string } },
    reference = new Date(),
  ): OverviewCoverageWindowItem {
    const expiresInDays = daysUntil(item.expiresAt, reference);

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
      isExpiringSoon: expiresInDays >= 0 && expiresInDays <= COVERAGE_EXPIRING_SOON_DAYS,
      expiresInDays,
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

  private readRuntimeSummary(value: Prisma.JsonValue | null): JobRuntimeSummary {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return buildEmptyRuntimeSummary();
    }

    const summary = value as Partial<JobRuntimeSummary>;
    const runtime = buildEmptyRuntimeSummary();

    runtime.attempts = typeof summary.attempts === "number" ? summary.attempts : 0;
    runtime.totalExpectedRecords = typeof summary.totalExpectedRecords === "number" ? summary.totalExpectedRecords : 0;
    runtime.totalFetchedRecords = typeof summary.totalFetchedRecords === "number" ? summary.totalFetchedRecords : 0;
    runtime.totalInsertedRecords = typeof summary.totalInsertedRecords === "number" ? summary.totalInsertedRecords : 0;
    runtime.totalPages = typeof summary.totalPages === "number" ? summary.totalPages : 0;
    runtime.completedPages = typeof summary.completedPages === "number" ? summary.completedPages : 0;
    runtime.lastFailureMessage = typeof summary.lastFailureMessage === "string" ? summary.lastFailureMessage : null;
    runtime.lastFailureReason = summary.lastFailureReason ?? null;
    runtime.checkpoint =
      summary.checkpoint && typeof summary.checkpoint === "object"
        ? {
            instanceId: summary.checkpoint.instanceId ?? null,
            instanceName: summary.checkpoint.instanceName ?? null,
            page: typeof summary.checkpoint.page === "number" ? summary.checkpoint.page : null,
            start: typeof summary.checkpoint.start === "number" ? summary.checkpoint.start : null,
            totalPages: typeof summary.checkpoint.totalPages === "number" ? summary.checkpoint.totalPages : null,
            expectedRecords:
              typeof summary.checkpoint.expectedRecords === "number" ? summary.checkpoint.expectedRecords : null,
            consecutiveFailures:
              typeof summary.checkpoint.consecutiveFailures === "number" ? summary.checkpoint.consecutiveFailures : 0,
            lastSuccessfulPage:
              typeof summary.checkpoint.lastSuccessfulPage === "number" ? summary.checkpoint.lastSuccessfulPage : 0,
            updatedAt: typeof summary.checkpoint.updatedAt === "string" ? summary.checkpoint.updatedAt : null,
          }
        : null;
    runtime.instanceProgress = Array.isArray(summary.instanceProgress)
      ? summary.instanceProgress.map((item) => ({
          instanceId: item.instanceId,
          instanceName: item.instanceName,
          status: item.status ?? "PENDING",
          expectedRecords: typeof item.expectedRecords === "number" ? item.expectedRecords : null,
          fetchedRecords: typeof item.fetchedRecords === "number" ? item.fetchedRecords : 0,
          insertedRecords: typeof item.insertedRecords === "number" ? item.insertedRecords : 0,
          totalPages: typeof item.totalPages === "number" ? item.totalPages : null,
          completedPages: typeof item.completedPages === "number" ? item.completedPages : 0,
          currentPage: typeof item.currentPage === "number" ? item.currentPage : null,
          currentStart: typeof item.currentStart === "number" ? item.currentStart : 0,
          storedFrom: typeof item.storedFrom === "string" ? item.storedFrom : null,
          storedUntil: typeof item.storedUntil === "string" ? item.storedUntil : null,
          consecutiveFailures: typeof item.consecutiveFailures === "number" ? item.consecutiveFailures : 0,
          lastErrorMessage: typeof item.lastErrorMessage === "string" ? item.lastErrorMessage : null,
          lastFailureReason: item.lastFailureReason ?? null,
          lastSuccessfulAt: typeof item.lastSuccessfulAt === "string" ? item.lastSuccessfulAt : null,
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
        }))
      : [];
    runtime.timeline = Array.isArray(summary.timeline)
      ? summary.timeline.map((item) => ({
          at: item.at,
          level: item.level,
          type: item.type,
          message: item.message,
          instanceId: item.instanceId ?? null,
          instanceName: item.instanceName ?? null,
          page: typeof item.page === "number" ? item.page : null,
          start: typeof item.start === "number" ? item.start : null,
          failureReason: item.failureReason ?? null,
        }))
      : [];

    return this.recalculateRuntime(runtime);
  }

  private prepareRuntimeForExecution(summary: JobRuntimeSummary, instances: PiholeManagedInstanceSummary[]) {
    const runtime = structuredClone(summary);

    for (const instance of instances) {
      const existing = runtime.instanceProgress.find((item) => item.instanceId === instance.id);

      if (!existing) {
        runtime.instanceProgress.push({
          instanceId: instance.id,
          instanceName: instance.name,
          status: "PENDING",
          expectedRecords: null,
          fetchedRecords: 0,
          insertedRecords: 0,
          totalPages: null,
          completedPages: 0,
          currentPage: null,
          currentStart: 0,
          storedFrom: null,
          storedUntil: null,
          consecutiveFailures: 0,
          lastErrorMessage: null,
          lastFailureReason: null,
          lastSuccessfulAt: null,
          updatedAt: null,
        });
        continue;
      }

      existing.instanceName = instance.name;

      if (existing.status === "FAILURE" || existing.status === "PAUSED" || existing.status === "PARTIAL") {
        existing.status = "PENDING";
      }
    }

    return this.recalculateRuntime(runtime);
  }

  private getOrCreateInstanceProgress(runtime: JobRuntimeSummary, instance: PiholeManagedInstanceSummary) {
    let progress = runtime.instanceProgress.find((item) => item.instanceId === instance.id);

    if (!progress) {
      progress = {
        instanceId: instance.id,
        instanceName: instance.name,
        status: "PENDING",
        expectedRecords: null,
        fetchedRecords: 0,
        insertedRecords: 0,
        totalPages: null,
        completedPages: 0,
        currentPage: null,
        currentStart: 0,
        storedFrom: null,
        storedUntil: null,
        consecutiveFailures: 0,
        lastErrorMessage: null,
        lastFailureReason: null,
        lastSuccessfulAt: null,
        updatedAt: null,
      };
      runtime.instanceProgress.push(progress);
    }

    return progress;
  }

  private buildCheckpoint(
    progress: JobRuntimeInstanceProgress,
    instance: PiholeManagedInstanceSummary,
  ): JobRuntimeCheckpoint {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
      page: Math.floor(progress.currentStart / DEFAULT_CHUNK_SIZE) + 1,
      start: progress.currentStart,
      totalPages: progress.totalPages,
      expectedRecords: progress.expectedRecords,
      consecutiveFailures: progress.consecutiveFailures,
      lastSuccessfulPage: progress.completedPages,
      updatedAt: new Date().toISOString(),
    };
  }

  private pushEvent(runtime: JobRuntimeSummary, event: Omit<JobRuntimeEvent, "at"> & { at?: string }) {
    runtime.timeline.push({
      at: event.at ?? new Date().toISOString(),
      level: event.level,
      type: event.type,
      message: event.message,
      instanceId: event.instanceId,
      instanceName: event.instanceName,
      page: event.page,
      start: event.start,
      failureReason: event.failureReason,
    });
    return runtime;
  }

  private recalculateRuntime(runtime: JobRuntimeSummary) {
    runtime.totalExpectedRecords = runtime.instanceProgress.reduce(
      (total, item) => total + (item.expectedRecords ?? 0),
      0,
    );
    runtime.totalFetchedRecords = runtime.instanceProgress.reduce((total, item) => total + item.fetchedRecords, 0);
    runtime.totalInsertedRecords = runtime.instanceProgress.reduce((total, item) => total + item.insertedRecords, 0);
    runtime.totalPages = runtime.instanceProgress.reduce((total, item) => total + (item.totalPages ?? 0), 0);
    runtime.completedPages = runtime.instanceProgress.reduce((total, item) => total + item.completedPages, 0);

    return runtime;
  }

  private serializeRuntimeSummary(runtime: JobRuntimeSummary): Prisma.InputJsonObject {
    return {
      version: 1,
      attempts: runtime.attempts,
      totalExpectedRecords: runtime.totalExpectedRecords,
      totalFetchedRecords: runtime.totalFetchedRecords,
      totalInsertedRecords: runtime.totalInsertedRecords,
      totalPages: runtime.totalPages,
      completedPages: runtime.completedPages,
      checkpoint: runtime.checkpoint,
      lastFailureMessage: runtime.lastFailureMessage,
      lastFailureReason: runtime.lastFailureReason,
      instanceProgress: runtime.instanceProgress,
      timeline: runtime.timeline,
    };
  }

  private toJobProgress(runtime: JobRuntimeSummary): OverviewJobProgress {
    return {
      attempts: runtime.attempts,
      totalExpectedRecords: runtime.totalExpectedRecords,
      totalFetchedRecords: runtime.totalFetchedRecords,
      totalInsertedRecords: runtime.totalInsertedRecords,
      totalPages: runtime.totalPages,
      completedPages: runtime.completedPages,
      checkpoint: runtime.checkpoint,
      lastFailureMessage: runtime.lastFailureMessage,
      lastFailureReason: runtime.lastFailureReason,
      instanceProgress: runtime.instanceProgress,
    };
  }

  private buildJobDiagnostics(runtime: JobRuntimeSummary) {
    const successfulProgress = [...runtime.instanceProgress]
      .filter((item) => item.lastSuccessfulAt)
      .sort((left, right) => {
        const leftValue = left.lastSuccessfulAt ? new Date(left.lastSuccessfulAt).getTime() : 0;
        const rightValue = right.lastSuccessfulAt ? new Date(right.lastSuccessfulAt).getTime() : 0;
        return rightValue - leftValue;
      })[0];
    const latestRetryEvent = [...runtime.timeline].reverse().find((event) => event.type === "retry_scheduled") ?? null;
    const stalledInstance = runtime.checkpoint?.instanceName ?? null;
    const stalledPage = runtime.checkpoint?.page ?? null;
    const stalledStart = runtime.checkpoint?.start ?? null;

    return {
      lastSuccessfulInstanceName: successfulProgress?.instanceName ?? null,
      lastSuccessfulPage: successfulProgress?.completedPages ?? null,
      lastSuccessfulAt: successfulProgress?.lastSuccessfulAt ?? null,
      stalledInstanceName: stalledInstance,
      stalledPage,
      stalledStart,
      nextRetryAt: latestRetryEvent?.at ?? null,
    };
  }

  private async persistJobRuntime(
    jobId: string,
    runtime: JobRuntimeSummary,
    data: Partial<Prisma.OverviewHistoryJobUpdateInput> = {},
  ) {
    return this.prisma.overviewHistoryJob.update({
      where: { id: jobId },
      data: {
        summary: this.serializeRuntimeSummary(runtime),
        ...data,
      },
    });
  }

  private async upsertCoverageWindow(
    jobId: string,
    instance: PiholeManagedInstanceSummary,
    range: HistoryRange,
    expiresAt: Date,
    progress: JobRuntimeInstanceProgress,
    status: OverviewJobStatus,
  ) {
    const existing = await this.prisma.overviewCoverageWindow.findFirst({
      where: {
        jobId,
        instanceId: instance.id,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const payload = {
      requestedFrom: range.from,
      requestedUntil: range.until,
      storedFrom: progress.storedFrom ? new Date(progress.storedFrom) : null,
      storedUntil: progress.storedUntil ? new Date(progress.storedUntil) : null,
      rowCount: progress.fetchedRecords,
      status,
      errorMessage: progress.lastErrorMessage,
      expiresAt,
    };

    if (existing) {
      await this.prisma.overviewCoverageWindow.update({
        where: { id: existing.id },
        data: payload,
      });
      return;
    }

    await this.prisma.overviewCoverageWindow.create({
      data: {
        jobId,
        instanceId: instance.id,
        ...payload,
      },
    });
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
        : job.status === "PAUSED"
          ? "Overview import paused after repeated failures."
          : job.status === "PARTIAL"
            ? "Overview import completed with partial failures."
            : "Overview import failed.";

    const runtime = this.readRuntimeSummary(job.summary);

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
        lastFailureReason: runtime.lastFailureReason,
        checkpoint: runtime.checkpoint,
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

  private async recordCoverageRenewalNotification(
    coverageWindow: CoverageWindowRecord & { instance: { name: string } },
    renewedQueryCount: number,
    expiresAt: Date,
    renewedAt: Date,
    request: Request,
  ) {
    await this.notifications.recordSystemEvent({
      type: "OVERVIEW_COVERAGE_RENEWED",
      fingerprint: `overview-coverage:${coverageWindow.id}`,
      message: "Overview coverage renewed for 30 more days.",
      instanceId: coverageWindow.instanceId,
      instanceName: coverageWindow.instance.name,
      metadata: {
        url: "/overview?tab=request",
        action: "coverage_renew",
        coverageWindowId: coverageWindow.id,
        jobId: coverageWindow.jobId,
        requestedFrom: coverageWindow.requestedFrom.toISOString(),
        requestedUntil: coverageWindow.requestedUntil.toISOString(),
        renewedAt: renewedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        renewedQueryCount,
        requestedBy: request.ip ?? null,
      } satisfies Prisma.InputJsonObject,
    });
  }

  private async markJobFailed(job: OverviewJobRecord, error: unknown) {
    const message = stringifyFailure(error);
    const failureReason = classifyFailureReason(message);
    const existing = await this.prisma.overviewHistoryJob.findUnique({
      where: { id: job.id },
    });
    let runtime = this.readRuntimeSummary(existing?.summary ?? job.summary);
    runtime.lastFailureMessage = message;
    runtime.lastFailureReason = failureReason;
    runtime = this.pushEvent(runtime, {
      level: "error",
      type: "job_failed",
      message,
      instanceId: runtime.checkpoint?.instanceId ?? null,
      instanceName: runtime.checkpoint?.instanceName ?? null,
      page: runtime.checkpoint?.page ?? null,
      start: runtime.checkpoint?.start ?? null,
      failureReason,
    });

    const updated = await this.prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "FAILURE",
        errorMessage: message,
        summary: this.serializeRuntimeSummary(runtime),
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
        failureReason,
        checkpoint: runtime.checkpoint,
      } satisfies Prisma.InputJsonObject,
    });
  }

  private delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
