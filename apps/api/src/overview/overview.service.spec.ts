import { OverviewService } from "./overview.service";
import assert from "node:assert/strict";
import test, { mock } from "node:test";

type OverviewJobRecord = {
  id: string;
  kind: "AUTOMATIC_IMPORT" | "MANUAL_IMPORT" | "MANUAL_DELETE";
  scope: "all" | "instance";
  instanceId: string | null;
  instanceNameSnapshot: string | null;
  requestedFrom: Date;
  requestedUntil: Date;
  status: "PENDING" | "RUNNING" | "PAUSED" | "CANCELLED" | "SUCCESS" | "PARTIAL" | "FAILURE";
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
  status: "PENDING" | "RUNNING" | "PAUSED" | "CANCELLED" | "SUCCESS" | "PARTIAL" | "FAILURE";
  errorMessage: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  instance: {
    name: string;
  };
};

type AutomaticImportRuleRecord = {
  id: string;
  name: string;
  enabled: boolean;
  cronExpression: string;
  scope: "all" | "instance";
  instanceId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: "SUCCESS" | "SKIPPED" | "FAILURE" | null;
  lastRunJobCount: number;
  lastRunSkippedCount: number;
  lastRunErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  instance?: {
    name: string;
  } | null;
};

type InstanceSummary = {
  id: string;
  name: string;
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

function makeAutomaticImportRule(overrides: Partial<AutomaticImportRuleRecord> = {}): AutomaticImportRuleRecord {
  const now = new Date("2026-04-29T12:00:00.000Z");

  return {
    id: overrides.id ?? "rule-1",
    name: overrides.name ?? "Daily import",
    enabled: overrides.enabled ?? true,
    cronExpression: overrides.cronExpression ?? "0 03 * * *",
    scope: overrides.scope ?? "all",
    instanceId: overrides.instanceId ?? null,
    lastRunAt: overrides.lastRunAt ?? null,
    lastRunStatus: overrides.lastRunStatus ?? null,
    lastRunJobCount: overrides.lastRunJobCount ?? 0,
    lastRunSkippedCount: overrides.lastRunSkippedCount ?? 0,
    lastRunErrorMessage: overrides.lastRunErrorMessage ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    instance: overrides.instance,
  };
}

function createPrismaStub(
  job: OverviewJobRecord,
  coverageWindow = makeCoverageWindow(),
  options: {
    jobs?: OverviewJobRecord[];
    enableQueueFind?: boolean;
    coverageWindows?: CoverageWindowRecord[];
    coverageStats?: unknown[];
    queryRawResults?: unknown[][];
    timeZone?: string;
    automaticImportRules?: AutomaticImportRuleRecord[];
  } = {},
) {
  const initialJobs = [job, ...(options.jobs ?? [])].map((item) => structuredClone(item));
  const initialAutomaticImportRules = options.automaticImportRules ?? [makeAutomaticImportRule()];
  const state = {
    job: structuredClone(job),
    jobs: initialJobs,
    automaticImportRules: initialAutomaticImportRules.map((item) => structuredClone(item)),
    createdAutomaticImportRuleData: null as unknown,
    createdJobData: null as unknown,
    coverageWindow: structuredClone(coverageWindow),
    coverageWindows: structuredClone(options.coverageWindows ?? []),
    coverageStats: structuredClone(options.coverageStats ?? []),
    queryRawResults: structuredClone(options.queryRawResults ?? []),
    deletedQueryWhere: null as unknown,
    deletedCoverageWhere: null as unknown,
    renewedQueryWhere: null as unknown,
    renewedQueryData: null as unknown,
    coverageWindowCount: 1,
  };
  const syncCurrentJob = (updated: OverviewJobRecord) => {
    const index = state.jobs.findIndex((item) => item.id === updated.id);

    if (index >= 0) {
      state.jobs[index] = structuredClone(updated);
    }

    if (state.job.id === updated.id) {
      state.job = structuredClone(updated);
    }
  };
  const matchesWhere = <T extends Record<string, unknown>>(candidate: T, where: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(where)) {
      if (key === "OR" && Array.isArray(value)) {
        if (!value.some((item) => matchesWhere(candidate, item as Record<string, unknown>))) {
          return false;
        }
        continue;
      }

      const candidateValue = candidate[key];

      if (value && typeof value === "object" && "in" in value) {
        if (!((value as { in: unknown[] }).in ?? []).includes(candidateValue)) {
          return false;
        }
        continue;
      }

      if (value && typeof value === "object" && "lte" in value) {
        const limit = (value as { lte: unknown }).lte;

        if (candidateValue instanceof Date && limit instanceof Date) {
          if (candidateValue.getTime() > limit.getTime()) {
            return false;
          }
        } else if (candidateValue > limit) {
          return false;
        }
        continue;
      }

      if (value && typeof value === "object" && "gte" in value) {
        const limit = (value as { gte: unknown }).gte;

        if (candidateValue instanceof Date && limit instanceof Date) {
          if (candidateValue.getTime() < limit.getTime()) {
            return false;
          }
        } else if (candidateValue < limit) {
          return false;
        }
        continue;
      }

      if (candidateValue instanceof Date && value instanceof Date) {
        if (candidateValue.getTime() !== value.getTime()) {
          return false;
        }
        continue;
      }

      if (candidateValue !== value) {
        return false;
      }
    }

    return true;
  };
  const matchesJobWhere = (candidate: OverviewJobRecord, where: Record<string, unknown>) =>
    matchesWhere(candidate as unknown as Record<string, unknown>, where);
  const matchesAutomaticRuleWhere = (candidate: AutomaticImportRuleRecord, where: Record<string, unknown>) =>
    matchesWhere(candidate as unknown as Record<string, unknown>, where);
  const sortJobs = (jobs: OverviewJobRecord[], orderBy?: Array<Record<string, "asc" | "desc">>) => {
    if (!orderBy) {
      return jobs;
    }

    return [...jobs].sort((left, right) => {
      for (const order of orderBy) {
        const [[field, direction]] = Object.entries(order);
        const leftValue = left[field as keyof OverviewJobRecord];
        const rightValue = right[field as keyof OverviewJobRecord];
        const comparison =
          leftValue instanceof Date && rightValue instanceof Date
            ? leftValue.getTime() - rightValue.getTime()
            : String(leftValue).localeCompare(String(rightValue));

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }

      return 0;
    });
  };

  return {
    state,
    overviewHistoryJob: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        structuredClone(state.jobs.find((item) => item.id === where.id) ?? null),
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
      }) => {
        if (!options.enableQueueFind && Object.keys(where).length === 1 && where.status === "PENDING") {
          return null;
        }

        return structuredClone(
          sortJobs(
            state.jobs.filter((item) => matchesJobWhere(item, where)),
            orderBy,
          )[0] ?? null,
        );
      },
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
        take?: number;
      } = {}) => {
        const matchedJobs = where ? state.jobs.filter((item) => matchesJobWhere(item, where)) : state.jobs;
        return structuredClone(sortJobs(matchedJobs, orderBy).slice(0, take));
      },
      create: async ({ data }: { data: Partial<OverviewJobRecord> }) => {
        state.createdJobData = data;
        state.job = makeJob({
          ...data,
          id: "job-created",
          status: "PENDING",
          createdAt: new Date("2026-04-29T12:05:00.000Z"),
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        });
        state.jobs.push(structuredClone(state.job));
        return structuredClone(state.job);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = state.jobs.find((item) => item.id === where.id);
        assert.ok(existing);
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        };
        syncCurrentJob(updated);
        return structuredClone(updated);
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;

        for (const existing of state.jobs) {
          if (!matchesJobWhere(existing, where)) {
            continue;
          }

          count += 1;
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date("2026-04-29T12:05:00.000Z"),
          };
          syncCurrentJob(updated);
        }

        return { count };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const existing = state.jobs.find((item) => item.id === where.id);
        assert.ok(existing);
        state.jobs = state.jobs.filter((item) => item.id !== where.id);
        return structuredClone(existing);
      },
    },
    overviewAutomaticImportRule: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { instance?: { select: { name: boolean } } };
      }) => {
        const rule = state.automaticImportRules.find((item) => item.id === where.id);

        if (!rule) {
          return null;
        }

        const instance = include?.instance
          ? ((options.instances ?? []).find((item) => item.id === rule.instanceId) ?? null)
          : undefined;

        return structuredClone({
          ...rule,
          ...(include?.instance ? { instance: instance ? { name: instance.name } : null } : {}),
        });
      },
      findMany: async ({
        where,
        orderBy,
        include,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
        include?: { instance?: { select: { name: boolean } } };
      } = {}) => {
        const matchedRules = where
          ? state.automaticImportRules.filter((item) => matchesAutomaticRuleWhere(item, where))
          : state.automaticImportRules;
        const mapped = sortJobs(matchedRules as unknown as OverviewJobRecord[], orderBy).map(
          (item) => item as unknown as AutomaticImportRuleRecord,
        );

        return structuredClone(
          mapped.map((rule) => {
            const instance = include?.instance
              ? ((options.instances ?? []).find((item) => item.id === rule.instanceId) ?? null)
              : undefined;

            return {
              ...rule,
              ...(include?.instance ? { instance: instance ? { name: instance.name } : null } : {}),
            };
          }),
        );
      },
      create: async ({
        data,
        include,
      }: {
        data: Partial<AutomaticImportRuleRecord>;
        include?: { instance?: { select: { name: boolean } } };
      }) => {
        state.createdAutomaticImportRuleData = data;
        const rule = makeAutomaticImportRule({
          ...data,
          id: "rule-created",
          createdAt: new Date("2026-04-29T12:05:00.000Z"),
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        });
        state.automaticImportRules.push(structuredClone(rule));
        const instance = include?.instance
          ? ((options.instances ?? []).find((item) => item.id === rule.instanceId) ?? null)
          : undefined;

        return structuredClone({
          ...rule,
          ...(include?.instance ? { instance: instance ? { name: instance.name } : null } : {}),
        });
      },
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: string };
        data: Partial<AutomaticImportRuleRecord>;
        include?: { instance?: { select: { name: boolean } } };
      }) => {
        const existing = state.automaticImportRules.find((item) => item.id === where.id);
        assert.ok(existing);
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date("2026-04-29T12:05:00.000Z"),
        };
        const index = state.automaticImportRules.findIndex((item) => item.id === where.id);
        state.automaticImportRules[index] = structuredClone(updated);
        const instance = include?.instance
          ? ((options.instances ?? []).find((item) => item.id === updated.instanceId) ?? null)
          : undefined;

        return structuredClone({
          ...updated,
          ...(include?.instance ? { instance: instance ? { name: instance.name } : null } : {}),
        });
      },
      delete: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { instance?: { select: { name: boolean } } };
      }) => {
        const existing = state.automaticImportRules.find((item) => item.id === where.id);
        assert.ok(existing);
        state.automaticImportRules = state.automaticImportRules.filter((item) => item.id !== where.id);
        const instance = include?.instance
          ? ((options.instances ?? []).find((item) => item.id === existing.instanceId) ?? null)
          : undefined;

        return structuredClone({
          ...existing,
          ...(include?.instance ? { instance: instance ? { name: instance.name } : null } : {}),
        });
      },
      count: async () => state.automaticImportRules.length,
    },
    historicalQuery: {
      groupBy: async () => structuredClone(state.coverageStats),
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
      findMany: async () => structuredClone(state.coverageWindows),
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
    appConfig: {
      findUnique: async () => ({ timeZone: options.timeZone ?? "UTC" }),
    },
    $queryRaw: async () => structuredClone(state.queryRawResults.shift() ?? []),
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
            const existing = state.jobs.find((item) => item.id === where.id);
            assert.ok(existing);
            state.jobs = state.jobs.filter((item) => item.id !== where.id);
            return structuredClone(existing);
          },
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = state.jobs.find((item) => item.id === where.id);
            assert.ok(existing);
            const updated = {
              ...existing,
              ...data,
              updatedAt: new Date("2026-04-29T12:05:00.000Z"),
            };
            syncCurrentJob(updated);
            return structuredClone(updated);
          },
        },
      }),
  };
}

function createService(
  job: OverviewJobRecord,
  options: {
    instances?: InstanceSummary[];
    jobs?: OverviewJobRecord[];
    enableQueueFind?: boolean;
    coverageWindows?: CoverageWindowRecord[];
    coverageStats?: unknown[];
    queryRawResults?: unknown[][];
    timeZone?: string;
    automaticImportRules?: AutomaticImportRuleRecord[];
  } = {},
) {
  const prisma = createPrismaStub(job, makeCoverageWindow(), options);
  const cronJobs = new Map<string, { stop: () => void }>();
  const service = new OverviewService(
    prisma as never,
    {
      getInstanceSummary: async (instanceId: string) =>
        (options.instances ?? []).find((instance) => instance.id === instanceId) ?? {
          id: instanceId,
          name: "Pi-hole A",
        },
      listInstanceSummaries: async () => options.instances ?? [],
    } as never,
    {} as never,
    {
      recordSystemEvent: async () => undefined,
    } as never,
    {
      getCronJobs: () => cronJobs,
      addCronJob: (name: string, cronJob: { stop: () => void }) => {
        cronJobs.set(name, cronJob);
      },
      deleteCronJob: (name: string) => {
        cronJobs.delete(name);
      },
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

test("deleteJob allows failed jobs but rejects non-terminal import jobs", async () => {
  const failedContext = createService(
    makeJob({
      id: "job-failed-delete",
      status: "FAILURE",
    }),
  );

  const result = await failedContext.service.deleteJob("job-failed-delete");

  assert.equal(result.job.id, "job-failed-delete");
  assert.deepEqual(failedContext.prisma.state.deletedQueryWhere, { jobId: "job-failed-delete" });
  assert.deepEqual(failedContext.prisma.state.deletedCoverageWhere, { jobId: "job-failed-delete" });

  const pausedContext = createService(
    makeJob({
      id: "job-paused-delete",
      status: "PAUSED",
    }),
  );

  const pausedResult = await pausedContext.service.deleteJob("job-paused-delete");

  assert.equal(pausedResult.job.id, "job-paused-delete");
  assert.deepEqual(pausedContext.prisma.state.deletedQueryWhere, { jobId: "job-paused-delete" });
  assert.deepEqual(pausedContext.prisma.state.deletedCoverageWhere, { jobId: "job-paused-delete" });

  const cancelledContext = createService(
    makeJob({
      id: "job-cancelled-delete",
      status: "CANCELLED",
    }),
  );

  const cancelledResult = await cancelledContext.service.deleteJob("job-cancelled-delete");

  assert.equal(cancelledResult.job.id, "job-cancelled-delete");
  assert.deepEqual(cancelledContext.prisma.state.deletedQueryWhere, { jobId: "job-cancelled-delete" });
  assert.deepEqual(cancelledContext.prisma.state.deletedCoverageWhere, { jobId: "job-cancelled-delete" });

  const partialContext = createService(
    makeJob({
      id: "job-partial-delete",
      status: "PARTIAL",
    }),
  );

  await assert.rejects(
    () => partialContext.service.deleteJob("job-partial-delete"),
    /Only successful, failed, paused, or cancelled jobs can be deleted\./,
  );
});

test("cancelJob marks only pending jobs as cancelled and keeps an audit timeline", async () => {
  const { service, prisma } = createService(
    makeJob({
      id: "job-cancel",
      status: "PENDING",
    }),
  );

  const result = await service.cancelJob("job-cancel");

  assert.equal(result.job.id, "job-cancel");
  assert.equal(result.job.status, "CANCELLED");
  assert.ok(result.job.finishedAt);
  assert.equal(result.job.errorMessage, null);
  assert.equal(prisma.state.job.status, "CANCELLED");

  const summary = prisma.state.job.summary as { timeline: Array<{ type: string; message: string }> };
  assert.equal(summary.timeline.at(-1)?.type, "job_cancelled");
  assert.match(summary.timeline.at(-1)?.message ?? "", /cancelled/);
});

test("cancelJob rejects jobs that already started or finished", async () => {
  for (const status of ["RUNNING", "SUCCESS", "PARTIAL", "FAILURE", "PAUSED"] as const) {
    const { service } = createService(
      makeJob({
        id: `job-${status.toLowerCase()}`,
        status,
      }),
    );

    await assert.rejects(() => service.cancelJob(`job-${status.toLowerCase()}`), /Only queued overview jobs/);
  }
});

test("runAutomaticImportRule expands all-instance rules into d-1 per-instance jobs in the app timezone", async () => {
  const { service, prisma } = createService(makeJob(), {
    timeZone: "America/Sao_Paulo",
    instances: [
      { id: "instance-1", name: "Pi-hole A" },
      { id: "instance-2", name: "Pi-hole B" },
    ],
    automaticImportRules: [makeAutomaticImportRule({ id: "rule-all", scope: "all" })],
  });

  await (
    service as unknown as {
      runAutomaticImportRule(ruleId: string, reference: Date): Promise<void>;
    }
  ).runAutomaticImportRule("rule-all", new Date("2026-04-29T12:00:00.000Z"));

  const createdJobs = prisma.state.jobs.filter((job) => job.id === "job-created");
  const createdJobData = prisma.state.createdJobData as {
    kind: string;
    scope: string;
    instanceId: string;
    requestedFrom: Date;
    requestedUntil: Date;
    trigger: string;
  };

  assert.equal(createdJobs.length, 2);
  assert.equal(createdJobData.kind, "AUTOMATIC_IMPORT");
  assert.equal(createdJobData.scope, "instance");
  assert.equal(createdJobData.instanceId, "instance-2");
  assert.equal(createdJobData.requestedFrom.toISOString(), "2026-04-28T03:00:00.000Z");
  assert.equal(createdJobData.requestedUntil.toISOString(), "2026-04-29T02:59:59.999Z");
  assert.equal(createdJobData.trigger, "cron");
  assert.equal(prisma.state.automaticImportRules[0].lastRunStatus, "SUCCESS");
  assert.equal(prisma.state.automaticImportRules[0].lastRunJobCount, 2);
});

test("runAutomaticImportRule keeps d-1 in the visual timezone when UTC is already the next day", async () => {
  const { service, prisma } = createService(makeJob(), {
    timeZone: "America/Sao_Paulo",
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    automaticImportRules: [
      makeAutomaticImportRule({ id: "rule-instance", scope: "instance", instanceId: "instance-1" }),
    ],
  });

  await (
    service as unknown as {
      runAutomaticImportRule(ruleId: string, reference: Date): Promise<void>;
    }
  ).runAutomaticImportRule("rule-instance", new Date("2026-05-16T01:45:00.000Z"));

  const createdJobData = prisma.state.createdJobData as {
    requestedFrom: Date;
    requestedUntil: Date;
  };

  assert.equal(createdJobData.requestedFrom.toISOString(), "2026-05-14T03:00:00.000Z");
  assert.equal(createdJobData.requestedUntil.toISOString(), "2026-05-15T02:59:59.999Z");
});

test("runAutomaticImportRule skips an instance when an import job already covers the d-1 window", async () => {
  const existingJob = makeJob({
    id: "job-existing-import",
    kind: "MANUAL_IMPORT",
    status: "SUCCESS",
    scope: "instance",
    instanceId: "instance-1",
    requestedFrom: new Date("2026-04-28T03:00:00.000Z"),
    requestedUntil: new Date("2026-04-29T02:59:59.000Z"),
  });
  const { service, prisma } = createService(existingJob, {
    timeZone: "America/Sao_Paulo",
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    automaticImportRules: [
      makeAutomaticImportRule({ id: "rule-instance", scope: "instance", instanceId: "instance-1" }),
    ],
  });

  await (
    service as unknown as {
      runAutomaticImportRule(ruleId: string, reference: Date): Promise<void>;
    }
  ).runAutomaticImportRule("rule-instance", new Date("2026-04-29T12:00:00.000Z"));

  assert.equal(prisma.state.createdJobData, null);
  assert.equal(prisma.state.automaticImportRules[0].lastRunStatus, "SKIPPED");
  assert.equal(prisma.state.automaticImportRules[0].lastRunSkippedCount, 1);
});

test("automatic import rule CRUD validates cron and instance scope", async () => {
  const { service, prisma } = createService(makeJob(), {
    timeZone: "America/Sao_Paulo",
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    automaticImportRules: [],
  });

  const created = await service.createAutomaticImportRule({
    name: "  Madrugada A  ",
    enabled: true,
    cronExpression: "0   4 * * *",
    scope: "instance",
    instanceId: "instance-1",
  } as never);

  assert.equal(created.rule.name, "Madrugada A");
  assert.equal(created.rule.cronExpression, "0 4 * * *");
  assert.equal(created.rule.scope, "instance");
  assert.equal(created.rule.instanceName, "Pi-hole A");
  assert.deepEqual(prisma.state.createdAutomaticImportRuleData, {
    name: "Madrugada A",
    enabled: true,
    cronExpression: "0 4 * * *",
    scope: "instance",
    instanceId: "instance-1",
  });

  const updated = await service.updateAutomaticImportRule("rule-created", {
    enabled: false,
    scope: "all",
  } as never);

  assert.equal(updated.rule.enabled, false);
  assert.equal(updated.rule.scope, "all");
  assert.equal(updated.rule.instanceId, null);
  assert.equal(updated.rule.nextRunAt, null);

  const deleted = await service.deleteAutomaticImportRule("rule-created");

  assert.equal(deleted.rule.id, "rule-created");
  assert.equal(prisma.state.automaticImportRules.length, 0);

  await assert.rejects(
    () =>
      service.createAutomaticImportRule({
        name: "Invalid cron",
        enabled: true,
        cronExpression: "not a cron",
        scope: "all",
      } as never),
    /Invalid cron expression/,
  );
});

test("enqueueManualImport accepts only one app-timezone calendar day", async () => {
  const sameDayContext = createService(makeJob(), {
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    timeZone: "America/Sao_Paulo",
  });

  const sameDayResult = await sameDayContext.service.enqueueManualImport(
    {
      scope: "all",
      from: Date.parse("2026-04-28T03:00:00.000Z") / 1000,
      until: Date.parse("2026-04-29T02:59:59.000Z") / 1000,
    } as never,
    {
      ip: "10.0.0.9",
      headers: {
        "accept-language": "en-US",
      },
    } as never,
  );

  assert.equal(sameDayResult.job.status, "PENDING");
  assert.equal(sameDayContext.prisma.state.job.requestedFrom.toISOString(), "2026-04-28T03:00:00.000Z");
  assert.equal(sameDayContext.prisma.state.job.requestedUntil.toISOString(), "2026-04-29T02:59:59.000Z");

  const crossDayContext = createService(makeJob(), {
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    timeZone: "America/Sao_Paulo",
  });

  await assert.rejects(
    () =>
      crossDayContext.service.enqueueManualImport(
        {
          scope: "all",
          from: Date.parse("2026-04-28T03:00:00.000Z") / 1000,
          until: Date.parse("2026-04-29T03:00:00.000Z") / 1000,
        } as never,
        {
          ip: "10.0.0.9",
          headers: {
            "accept-language": "en-US",
          },
        } as never,
      ),
    /single calendar day/,
  );
});

test("enqueueManualImport reuses an identical pending or running job", async () => {
  const existingJob = makeJob({
    id: "job-existing",
    status: "RUNNING",
    requestedFrom: new Date("2026-04-28T03:00:00.000Z"),
    requestedUntil: new Date("2026-04-29T02:59:59.000Z"),
  });
  const { service, prisma } = createService(existingJob, {
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    timeZone: "America/Sao_Paulo",
  });

  const result = await service.enqueueManualImport(
    {
      scope: "all",
      from: Date.parse("2026-04-28T03:00:00.000Z") / 1000,
      until: Date.parse("2026-04-29T02:59:59.000Z") / 1000,
    } as never,
    {
      ip: "10.0.0.9",
      headers: {
        "accept-language": "en-US",
      },
    } as never,
  );

  assert.equal(result.job.id, "job-existing");
  assert.equal(result.job.status, "RUNNING");
  assert.equal(prisma.state.createdJobData, null);
});

test("overview queue drains pending jobs sequentially in FIFO order", async () => {
  const firstJob = makeJob({
    id: "job-first",
    status: "PENDING",
    createdAt: new Date("2026-04-29T12:00:00.000Z"),
  });
  const secondJob = makeJob({
    id: "job-second",
    status: "PENDING",
    requestedFrom: new Date("2026-04-27T00:00:00.000Z"),
    requestedUntil: new Date("2026-04-27T23:59:59.000Z"),
    createdAt: new Date("2026-04-29T12:01:00.000Z"),
  });
  const { service, prisma } = createService(firstJob, {
    enableQueueFind: true,
    jobs: [secondJob],
  });
  const queueService = service as unknown as {
    drainOverviewJobQueue: () => Promise<void>;
    runImportJob: (job: OverviewJobRecord) => Promise<void>;
  };
  const executionOrder: string[] = [];
  let activeExecutions = 0;
  let maxActiveExecutions = 0;

  queueService.runImportJob = async (job) => {
    activeExecutions += 1;
    maxActiveExecutions = Math.max(maxActiveExecutions, activeExecutions);
    executionOrder.push(job.id);
    await Promise.resolve();
    await prisma.overviewHistoryJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        startedAt: new Date("2026-04-29T12:05:00.000Z"),
        finishedAt: new Date("2026-04-29T12:06:00.000Z"),
      },
    });
    activeExecutions -= 1;
  };

  await queueService.drainOverviewJobQueue();

  assert.deepEqual(executionOrder, ["job-first", "job-second"]);
  assert.equal(maxActiveExecutions, 1);
  assert.deepEqual(
    prisma.state.jobs.map((job) => [job.id, job.status]),
    [
      ["job-first", "SUCCESS"],
      ["job-second", "SUCCESS"],
    ],
  );
});

test("overview queue does not execute a job cancelled before it is claimed", async () => {
  const { service, prisma } = createService(
    makeJob({
      id: "job-race",
      status: "PENDING",
    }),
    {
      enableQueueFind: true,
    },
  );
  const queueService = service as unknown as {
    drainOverviewJobQueue: () => Promise<void>;
    runImportJob: (job: OverviewJobRecord) => Promise<void>;
  };
  const originalFindFirst = prisma.overviewHistoryJob.findFirst;
  let cancelledBeforeClaim = false;
  let executionCount = 0;

  prisma.overviewHistoryJob.findFirst = async (args) => {
    const found = await originalFindFirst(args);

    if (found && !cancelledBeforeClaim && args.where.status === "PENDING") {
      cancelledBeforeClaim = true;
      const job = prisma.state.jobs.find((item) => item.id === found.id);

      assert.ok(job);
      job.status = "CANCELLED";
    }

    return found;
  };
  queueService.runImportJob = async () => {
    executionCount += 1;
  };

  await queueService.drainOverviewJobQueue();

  assert.equal(executionCount, 0);
  assert.equal(prisma.state.jobs.find((job) => job.id === "job-race")?.status, "CANCELLED");
});

test("onModuleInit preserves pending jobs and marks only running jobs as interrupted", async () => {
  const pendingJob = makeJob({
    id: "job-pending",
    status: "PENDING",
  });
  const runningJob = makeJob({
    id: "job-running",
    status: "RUNNING",
  });
  const { service, prisma } = createService(pendingJob, {
    jobs: [runningJob],
    automaticImportRules: [],
  });

  await service.onModuleInit();

  assert.equal(prisma.state.jobs.find((job) => job.id === "job-pending")?.status, "PENDING");
  assert.equal(prisma.state.jobs.find((job) => job.id === "job-running")?.status, "FAILURE");
  assert.equal(
    prisma.state.jobs.find((job) => job.id === "job-running")?.errorMessage,
    "Interrupted by application restart.",
  );
});

test("getOverview fallback range uses the application timezone instead of the container timezone", async () => {
  mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-05-16T01:45:00.000Z"),
  });

  try {
    const context = createService(makeJob(), {
      instances: [{ id: "instance-1", name: "Pi-hole A" }],
      timeZone: "America/Sao_Paulo",
      queryRawResults: [
        [
          {
            totalQueries: 0,
            blockedQueries: 0,
            cachedQueries: 0,
            forwardedQueries: 0,
            uniqueDomains: 0,
            uniqueClients: 0,
          },
        ],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
    });

    const result = await context.service.getOverview(
      {
        scope: "all",
        groupBy: "hour",
      } as never,
      {
        headers: {
          "accept-language": "en-US",
        },
      } as never,
    );

    assert.equal(result.filters.from, "2026-05-08T03:00:00.000Z");
    assert.equal(result.filters.until, "2026-05-15T02:59:59.999Z");
    assert.equal(result.coverage.requestedFrom, "2026-05-08T03:00:00.000Z");
    assert.equal(result.coverage.requestedUntil, "2026-05-15T02:59:59.999Z");
  } finally {
    mock.timers.reset();
  }
});

test("getOverview exposes saved dates grouped by stored historical query day", async () => {
  const context = createService(makeJob(), {
    instances: [{ id: "instance-1", name: "Pi-hole A" }],
    timeZone: "America/Sao_Paulo",
    queryRawResults: [
      [
        {
          totalQueries: 0,
          blockedQueries: 0,
          cachedQueries: 0,
          forwardedQueries: 0,
          uniqueDomains: 0,
          uniqueClients: 0,
        },
      ],
      [],
      [],
      [],
      [],
      [],
      [
        {
          date: "2026-04-28",
          rowCount: 1500n,
          instanceCount: 1n,
          storedFrom: new Date("2026-04-28T03:00:00.000Z"),
          storedUntil: new Date("2026-04-29T02:59:59.000Z"),
        },
      ],
    ],
  });

  const result = await context.service.getOverview(
    {
      scope: "all",
      groupBy: "hour",
      from: Date.parse("2026-04-28T03:00:00.000Z") / 1000,
      until: Date.parse("2026-04-29T02:59:59.000Z") / 1000,
    } as never,
    {
      headers: {
        "accept-language": "en-US",
      },
    } as never,
  );

  assert.deepEqual(result.coverage.savedDates, [
    {
      date: "2026-04-28",
      rowCount: 1500,
      instanceCount: 1,
      storedFrom: "2026-04-28T03:00:00.000Z",
      storedUntil: "2026-04-29T02:59:59.000Z",
    },
  ]);
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

test("retryJob can requeue a cancelled job", async () => {
  const { service, prisma } = createService(
    makeJob({
      id: "job-cancelled-retry",
      status: "CANCELLED",
      finishedAt: new Date("2026-04-29T12:05:00.000Z"),
    }),
  );

  const result = await service.retryJob("job-cancelled-retry", {
    ip: "10.0.0.9",
    headers: {
      "accept-language": "en-US",
    },
  } as never);

  assert.equal(result.job.id, "job-cancelled-retry");
  assert.equal(result.job.status, "PENDING");
  assert.equal(result.job.startedAt, null);
  assert.equal(result.job.finishedAt, null);
  assert.equal(prisma.state.job.status, "PENDING");
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
