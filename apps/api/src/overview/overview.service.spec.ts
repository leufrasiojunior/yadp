import { OverviewService } from "./overview.service";
import assert from "node:assert/strict";
import test from "node:test";

type OverviewJobRecord = {
  id: string;
  kind: "AUTOMATIC_IMPORT" | "MANUAL_IMPORT" | "MANUAL_DELETE";
  scope: "all" | "instance";
  instanceId: string | null;
  instanceNameSnapshot: string | null;
  requestedFrom: Date;
  requestedUntil: Date;
  status: "PENDING" | "RUNNING" | "PAUSED" | "SUCCESS" | "PARTIAL" | "FAILURE";
  trigger: string | null;
  requestedBy: string | null;
  summary: unknown;
  errorMessage: string | null;
  queryCount: number;
  deletedCount: number;
  coverageCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CoverageWindowRecord = {
  id: string;
  jobId: string | null;
  instanceId: string;
  requestedFrom: Date;
  requestedUntil: Date;
  storedFrom: Date | null;
  storedUntil: Date | null;
  rowCount: number;
  status: "PENDING" | "RUNNING" | "PAUSED" | "SUCCESS" | "PARTIAL" | "FAILURE";
  errorMessage: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  instance: {
    name: string;
  };
};

function makeJob(overrides: Partial<OverviewJobRecord> = {}): OverviewJobRecord {
  const now = new Date("2026-04-29T12:00:00.000Z");

  return {
    id: overrides.id ?? "job-1",
    kind: overrides.kind ?? "MANUAL_IMPORT",
    scope: overrides.scope ?? "all",
    instanceId: overrides.instanceId ?? null,
    instanceNameSnapshot: overrides.instanceNameSnapshot ?? null,
    requestedFrom: overrides.requestedFrom ?? new Date("2026-04-28T00:00:00.000Z"),
    requestedUntil: overrides.requestedUntil ?? new Date("2026-04-28T23:59:59.000Z"),
    status: overrides.status ?? "SUCCESS",
    trigger: overrides.trigger ?? "user",
    requestedBy: overrides.requestedBy ?? "127.0.0.1",
    summary: overrides.summary ?? null,
    errorMessage: overrides.errorMessage ?? null,
    queryCount: overrides.queryCount ?? 0,
    deletedCount: overrides.deletedCount ?? 0,
    coverageCount: overrides.coverageCount ?? 0,
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeCoverageWindow(overrides: Partial<CoverageWindowRecord> = {}): CoverageWindowRecord {
  const now = new Date("2026-04-29T12:00:00.000Z");

  return {
    id: overrides.id ?? "coverage-1",
    jobId: overrides.jobId ?? "job-1",
    instanceId: overrides.instanceId ?? "instance-1",
    requestedFrom: overrides.requestedFrom ?? new Date("2026-04-28T00:00:00.000Z"),
    requestedUntil: overrides.requestedUntil ?? new Date("2026-04-28T23:59:59.000Z"),
    storedFrom: overrides.storedFrom ?? new Date("2026-04-28T00:00:10.000Z"),
    storedUntil: overrides.storedUntil ?? new Date("2026-04-28T23:59:20.000Z"),
    rowCount: overrides.rowCount ?? 100,
    status: overrides.status ?? "SUCCESS",
    errorMessage: overrides.errorMessage ?? null,
    expiresAt: overrides.expiresAt ?? new Date("2026-05-29T12:00:00.000Z"),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    instance: overrides.instance ?? { name: "Pi-hole A" },
  };
}

function createPrismaStub(job: OverviewJobRecord, coverageWindow = makeCoverageWindow()) {
  const state = {
    job: structuredClone(job),
    coverageWindow: structuredClone(coverageWindow),
    deletedQueryWhere: null as unknown,
    deletedCoverageWhere: null as unknown,
    renewedQueryWhere: null as unknown,
    renewedQueryData: null as unknown,
    coverageWindowCount: 1,
  };

  return {
    state,
    overviewHistoryJob: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.job.id ? structuredClone(state.job) : null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        assert.equal(where.id, state.job.id);
        state.job = {
          ...state.job,
          ...data,
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        };
        return structuredClone(state.job);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, state.job.id);
        return structuredClone(state.job);
      },
    },
    historicalQuery: {
      deleteMany: async ({ where }: { where: unknown }) => {
        state.deletedQueryWhere = where;
        return { count: 12 };
      },
      updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
        state.renewedQueryWhere = where;
        state.renewedQueryData = data;
        return { count: 100 };
      },
    },
    overviewCoverageWindow: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.coverageWindow.id ? structuredClone(state.coverageWindow) : null,
      count: async () => state.coverageWindowCount,
      deleteMany: async ({ where }: { where: unknown }) => {
        state.deletedCoverageWhere = where;
        return { count: 3 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        assert.equal(where.id, state.coverageWindow.id);
        state.coverageWindow = {
          ...state.coverageWindow,
          ...data,
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        };
        return structuredClone(state.coverageWindow);
      },
    },
    $transaction: async <T>(callback: (tx: Record<string, unknown>) => Promise<T>) =>
      callback({
        historicalQuery: {
          deleteMany: async ({ where }: { where: unknown }) => {
            state.deletedQueryWhere = where;
            return { count: 12 };
          },
          updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
            state.renewedQueryWhere = where;
            state.renewedQueryData = data;
            return { count: 100 };
          },
        },
        overviewCoverageWindow: {
          deleteMany: async ({ where }: { where: unknown }) => {
            state.deletedCoverageWhere = where;
            return { count: 3 };
          },
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            assert.equal(where.id, state.coverageWindow.id);
            state.coverageWindow = {
              ...state.coverageWindow,
              ...data,
              updatedAt: new Date("2026-04-29T12:05:00.000Z"),
            };
            return structuredClone(state.coverageWindow);
          },
        },
        overviewHistoryJob: {
          delete: async ({ where }: { where: { id: string } }) => {
            assert.equal(where.id, state.job.id);
            return structuredClone(state.job);
          },
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            assert.equal(where.id, state.job.id);
            state.job = {
              ...state.job,
              ...data,
              updatedAt: new Date("2026-04-29T12:05:00.000Z"),
            };
            return structuredClone(state.job);
          },
        },
      }),
  };
}

function createService(job: OverviewJobRecord) {
  const prisma = createPrismaStub(job);
  const service = new OverviewService(
    prisma as never,
    {
      getInstanceSummary: async () => {
        throw new Error("not needed");
      },
      listInstanceSummaries: async () => [],
    } as never,
    {} as never,
    {
      recordSystemEvent: async () => undefined,
    } as never,
  );

  return { service, prisma };
}

test("deleteJob removes linked historical queries, coverage windows, and the job itself", async () => {
  const { service, prisma } = createService(
    makeJob({
      id: "job-delete",
      status: "SUCCESS",
    }),
  );

  const result = await service.deleteJob("job-delete");

  assert.equal(result.job.id, "job-delete");
  assert.deepEqual(prisma.state.deletedQueryWhere, { jobId: "job-delete" });
  assert.deepEqual(prisma.state.deletedCoverageWhere, { jobId: "job-delete" });
});

test("retryJob reuses the same paused job and preserves checkpoint summary", async () => {
  const summary = {
    version: 1,
    attempts: 1,
    totalExpectedRecords: 2000,
    totalFetchedRecords: 1000,
    totalInsertedRecords: 1000,
    totalPages: 4,
    completedPages: 2,
    checkpoint: {
      instanceId: "instance-1",
      instanceName: "Pi-hole A",
      page: 3,
      start: 1000,
      totalPages: 4,
      expectedRecords: 2000,
      consecutiveFailures: 3,
      lastSuccessfulPage: 2,
      updatedAt: "2026-04-29T12:00:00.000Z",
    },
    lastFailureMessage: "Timeout while fetching page 3.",
    lastFailureReason: "timeout",
    instanceProgress: [],
    timeline: [],
  };
  const { service, prisma } = createService(
    makeJob({
      id: "job-paused",
      status: "PAUSED",
      summary,
      errorMessage: "Timeout while fetching page 3.",
    }),
  );

  const result = await service.retryJob("job-paused", {
    ip: "10.0.0.9",
    headers: {
      "accept-language": "en-US",
    },
  } as never);

  assert.equal(result.job.id, "job-paused");
  assert.equal(result.job.status, "PENDING");
  assert.equal(result.job.progress.checkpoint?.start, 1000);
  assert.equal(prisma.state.job.id, "job-paused");
  assert.equal(prisma.state.job.status, "PENDING");
  assert.deepEqual(prisma.state.job.summary, summary);
});

test("getJobDetails exposes explicit diagnostics for the latest successful step and the stalled checkpoint", async () => {
  const summary = {
    version: 1,
    attempts: 2,
    totalExpectedRecords: 2000,
    totalFetchedRecords: 1500,
    totalInsertedRecords: 1500,
    totalPages: 4,
    completedPages: 3,
    checkpoint: {
      instanceId: "instance-2",
      instanceName: "Pi-hole B",
      page: 4,
      start: 1500,
      totalPages: 4,
      expectedRecords: 2000,
      consecutiveFailures: 2,
      lastSuccessfulPage: 3,
      updatedAt: "2026-04-29T12:04:00.000Z",
    },
    lastFailureMessage: "Timeout while fetching page 4.",
    lastFailureReason: "timeout",
    instanceProgress: [
      {
        instanceId: "instance-2",
        instanceName: "Pi-hole B",
        status: "RUNNING",
        expectedRecords: 2000,
        fetchedRecords: 1500,
        insertedRecords: 1500,
        totalPages: 4,
        completedPages: 3,
        currentPage: 4,
        currentStart: 1500,
        storedFrom: "2026-04-28T00:00:00.000Z",
        storedUntil: "2026-04-28T18:00:00.000Z",
        consecutiveFailures: 2,
        lastErrorMessage: "Timeout while fetching page 4.",
        lastFailureReason: "timeout",
        lastSuccessfulAt: "2026-04-29T12:03:00.000Z",
        updatedAt: "2026-04-29T12:04:00.000Z",
      },
    ],
    timeline: [
      {
        at: "2026-04-29T12:03:00.000Z",
        level: "info",
        type: "page_saved",
        message: "Pi-hole B saved page 3.",
        instanceId: "instance-2",
        instanceName: "Pi-hole B",
        page: 3,
        start: 1000,
        failureReason: null,
      },
      {
        at: "2026-04-29T12:04:00.000Z",
        level: "warn",
        type: "retry_scheduled",
        message: "Retry scheduled in 1 minute for Pi-hole B page 4.",
        instanceId: "instance-2",
        instanceName: "Pi-hole B",
        page: 4,
        start: 1500,
        failureReason: "timeout",
      },
    ],
  };
  const { service } = createService(
    makeJob({
      id: "job-details",
      status: "PAUSED",
      summary,
      errorMessage: "Timeout while fetching page 4.",
    }),
  );

  const result = await service.getJobDetails("job-details");

  assert.equal(result.job.diagnostics.lastSuccessfulInstanceName, "Pi-hole B");
  assert.equal(result.job.diagnostics.lastSuccessfulPage, 3);
  assert.equal(result.job.diagnostics.stalledInstanceName, "Pi-hole B");
  assert.equal(result.job.diagnostics.stalledPage, 4);
  assert.equal(result.job.diagnostics.stalledStart, 1500);
  assert.equal(result.job.diagnostics.nextRetryAt, "2026-04-29T12:04:00.000Z");
});

test("renewCoverage extends ttl for the coverage window and stored historical queries without creating a new job", async () => {
  const coverageWindow = makeCoverageWindow({
    id: "coverage-renew",
    jobId: "job-renew",
    instanceId: "instance-renew",
    requestedFrom: new Date("2026-04-10T00:00:00.000Z"),
    requestedUntil: new Date("2026-04-10T23:59:59.000Z"),
  });
  const { service, prisma } = createService(
    makeJob({
      id: "job-renew",
      status: "SUCCESS",
    }),
  );
  prisma.state.coverageWindow = structuredClone(coverageWindow);

  const result = await service.renewCoverage("coverage-renew", {
    ip: "10.0.0.8",
  } as never);

  assert.equal(result.coverageWindow.id, "coverage-renew");
  assert.equal(result.renewedQueryCount, 100);
  assert.deepEqual(prisma.state.renewedQueryWhere, {
    jobId: "job-renew",
    instanceId: "instance-renew",
  });
  assert.ok(prisma.state.renewedQueryData);
  assert.notEqual(prisma.state.coverageWindow.expiresAt.toISOString(), coverageWindow.expiresAt.toISOString());
  assert.equal(prisma.state.job.id, "job-renew");
});

test("renewCoverage targets only the linked job queries when the period overlaps another saved window", async () => {
  const coverageWindow = makeCoverageWindow({
    id: "coverage-overlap",
    jobId: "job-overlap",
    instanceId: "instance-overlap",
  });
  const { service, prisma } = createService(
    makeJob({
      id: "job-overlap",
      status: "SUCCESS",
    }),
  );
  prisma.state.coverageWindow = structuredClone(coverageWindow);
  prisma.state.coverageWindowCount = 2;

  await service.renewCoverage("coverage-overlap", {
    ip: "10.0.0.8",
  } as never);

  assert.deepEqual(prisma.state.renewedQueryWhere, {
    jobId: "job-overlap",
    instanceId: "instance-overlap",
  });
});
