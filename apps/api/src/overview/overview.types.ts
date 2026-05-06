export const OVERVIEW_SCOPE_VALUES = ["all", "instance"] as const;
export const OVERVIEW_GROUP_BY_VALUES = ["hour", "day"] as const;
export const OVERVIEW_JOB_KIND_VALUES = ["AUTOMATIC_IMPORT", "MANUAL_IMPORT", "MANUAL_DELETE"] as const;
export const OVERVIEW_JOB_STATUS_VALUES = ["PENDING", "RUNNING", "PAUSED", "SUCCESS", "PARTIAL", "FAILURE"] as const;
export const OVERVIEW_FAILURE_KIND_VALUES = ["missing_data", "import_failure"] as const;
export const OVERVIEW_JOB_FAILURE_REASON_VALUES = [
  "timeout",
  "session",
  "server_unavailable",
  "count_mismatch",
  "unexpected",
] as const;
export const OVERVIEW_JOB_EVENT_LEVEL_VALUES = ["info", "warn", "error"] as const;

export type OverviewScopeMode = (typeof OVERVIEW_SCOPE_VALUES)[number];
export type OverviewGroupBy = (typeof OVERVIEW_GROUP_BY_VALUES)[number];
export type OverviewJobKind = (typeof OVERVIEW_JOB_KIND_VALUES)[number];
export type OverviewJobStatus = (typeof OVERVIEW_JOB_STATUS_VALUES)[number];
export type OverviewFailureKind = (typeof OVERVIEW_FAILURE_KIND_VALUES)[number];
export type OverviewJobFailureReason = (typeof OVERVIEW_JOB_FAILURE_REASON_VALUES)[number];
export type OverviewJobEventLevel = (typeof OVERVIEW_JOB_EVENT_LEVEL_VALUES)[number];

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
  isExpiringSoon: boolean;
  expiresInDays: number;
};

export type OverviewCoverageRenewResponse = {
  coverageWindow: OverviewCoverageWindowItem;
  renewedQueryCount: number;
  renewedAt: string;
};

export type OverviewJobCheckpoint = {
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

export type OverviewJobInstanceProgress = {
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

export type OverviewJobEvent = {
  at: string;
  level: OverviewJobEventLevel;
  type: string;
  message: string;
  instanceId: string | null;
  instanceName: string | null;
  page: number | null;
  start: number | null;
  failureReason: OverviewJobFailureReason | null;
};

export type OverviewJobProgress = {
  attempts: number;
  totalExpectedRecords: number;
  totalFetchedRecords: number;
  totalInsertedRecords: number;
  totalPages: number;
  completedPages: number;
  checkpoint: OverviewJobCheckpoint | null;
  lastFailureMessage: string | null;
  lastFailureReason: OverviewJobFailureReason | null;
  instanceProgress: OverviewJobInstanceProgress[];
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
  failureReason: OverviewJobFailureReason | null;
  progress: OverviewJobProgress;
};

export type OverviewJobsResponse = {
  jobs: OverviewJobSummary[];
};

export type OverviewJobDetails = OverviewJobSummary & {
  diagnostics: {
    lastSuccessfulInstanceName: string | null;
    lastSuccessfulPage: number | null;
    lastSuccessfulAt: string | null;
    stalledInstanceName: string | null;
    stalledPage: number | null;
    stalledStart: number | null;
    nextRetryAt: string | null;
  };
  timeline: OverviewJobEvent[];
};

export type OverviewJobDetailsResponse = {
  job: OverviewJobDetails;
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
    savedWindowCount: number;
    expiringSoonCount: number;
    windows: OverviewCoverageWindowItem[];
    savedWindows: OverviewCoverageWindowItem[];
    expiringWindows: OverviewCoverageWindowItem[];
  };
  sources: {
    totalInstances: number;
    availableInstances: OverviewInstanceSource[];
    failedInstances: OverviewInstanceFailure[];
  };
};
