export const OVERVIEW_SCOPE_VALUES = ["all", "instance"] as const;
export const OVERVIEW_GROUP_BY_VALUES = ["hour", "day"] as const;
export const OVERVIEW_JOB_KIND_VALUES = ["AUTOMATIC_IMPORT", "MANUAL_IMPORT", "MANUAL_DELETE"] as const;
export const OVERVIEW_JOB_STATUS_VALUES = ["PENDING", "RUNNING", "SUCCESS", "PARTIAL", "FAILURE"] as const;
export const OVERVIEW_FAILURE_KIND_VALUES = ["missing_data", "import_failure"] as const;

export type OverviewScopeMode = (typeof OVERVIEW_SCOPE_VALUES)[number];
export type OverviewGroupBy = (typeof OVERVIEW_GROUP_BY_VALUES)[number];
export type OverviewJobKind = (typeof OVERVIEW_JOB_KIND_VALUES)[number];
export type OverviewJobStatus = (typeof OVERVIEW_JOB_STATUS_VALUES)[number];
export type OverviewFailureKind = (typeof OVERVIEW_FAILURE_KIND_VALUES)[number];

export type OverviewInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type OverviewInstanceFailure = OverviewInstanceSource & {
  kind: OverviewFailureKind;
  message: string;
};

export type OverviewRankingItem = {
  value: string;
  count: number;
};

export type OverviewChartPoint = {
  timestamp: string;
  totalQueries: number;
  blockedQueries: number;
  cachedQueries: number;
  forwardedQueries: number;
  percentageBlocked: number;
};

export type OverviewCoverageWindowItem = {
  id: string;
  jobId: string | null;
  instanceId: string;
  instanceName: string;
  requestedFrom: string;
  requestedUntil: string;
  storedFrom: string | null;
  storedUntil: string | null;
  rowCount: number;
  status: OverviewJobStatus;
  errorMessage: string | null;
  expiresAt: string;
};

export type OverviewJobSummary = {
  id: string;
  kind: OverviewJobKind;
  scope: OverviewScopeMode;
  instanceId: string | null;
  instanceName: string | null;
  requestedFrom: string;
  requestedUntil: string;
  status: OverviewJobStatus;
  trigger: string | null;
  requestedBy: string | null;
  queryCount: number;
  deletedCount: number;
  coverageCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  summary: unknown;
};

export type OverviewJobsResponse = {
  jobs: OverviewJobSummary[];
};

export type OverviewMutationResponse = {
  job: OverviewJobSummary;
};

export type OverviewJobDeleteResponse = {
  job: OverviewJobSummary;
};

export type OverviewResponse = {
  scope: {
    mode: OverviewScopeMode;
    instanceId: string | null;
    instanceName: string | null;
  };
  filters: {
    from: string;
    until: string;
    groupBy: OverviewGroupBy;
  };
  summary: {
    totalQueries: number;
    blockedQueries: number;
    cachedQueries: number;
    forwardedQueries: number;
    uniqueDomains: number;
    uniqueClients: number;
    percentageBlocked: number;
  };
  charts: {
    queries: {
      groupBy: OverviewGroupBy;
      points: OverviewChartPoint[];
    };
  };
  rankings: {
    domains: OverviewRankingItem[];
    clients: OverviewRankingItem[];
    upstreams: OverviewRankingItem[];
    statuses: OverviewRankingItem[];
  };
  coverage: {
    hasAnyData: boolean;
    requestedFrom: string;
    requestedUntil: string;
    totalStoredQueries: number;
    earliestStoredAt: string | null;
    latestStoredAt: string | null;
    windows: OverviewCoverageWindowItem[];
  };
  sources: {
    totalInstances: number;
    availableInstances: OverviewInstanceSource[];
    failedInstances: OverviewInstanceFailure[];
  };
};
