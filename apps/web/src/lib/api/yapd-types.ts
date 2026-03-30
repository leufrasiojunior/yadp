import type { AppSession } from "@/components/yapd/app-session-provider";

export type SetupCredentialMode = "shared" | "individual";

export type SetupLoginMode = "pihole-master" | "yapd-password";

export type BaselineSummary = {
  id: string;
  name: string;
  baseUrl: string;
};

export type SetupStatus = {
  needsSetup: boolean;
  baselineConfigured: boolean;
  loginMode: SetupLoginMode | null;
  baseline: BaselineSummary | null;
};

export type SetupInstanceInput = {
  name?: string;
  baseUrl?: string;
  isMaster?: boolean;
  allowSelfSigned?: boolean;
  password?: string;
};

export type SetupBaselineRequest = {
  credentialsMode: SetupCredentialMode;
  sharedPassword?: string;
  instances: SetupInstanceInput[];
  loginMode: SetupLoginMode;
  yapdPassword?: string;
};

export type SetupBaselineResponse = {
  message: string;
  baseline: (BaselineSummary & { version: string }) | null;
  createdCount: number;
  loginMode: SetupLoginMode;
};

export type InstanceItem = {
  id: string;
  name: string;
  baseUrl: string;
  isBaseline: boolean;
  lastKnownVersion: string | null;
  lastValidatedAt: string | null;
  trustMode: string;
  hasCustomCertificate: boolean;
  createdAt: string;
  updatedAt: string;
  sessionStatus: "active" | "expired" | "missing" | "error";
  sessionManagedBy: "human-master" | "stored-secret" | null;
  sessionLoginAt: string | null;
  sessionLastActiveAt: string | null;
  sessionValidUntil: string | null;
  sessionLastErrorKind: DashboardInstanceErrorKind | null;
  sessionLastErrorMessage: string | null;
};

export type InstanceListResponse = {
  items: InstanceItem[];
};

export type DiscoverInstanceItem = {
  baseUrl: string;
  reachable: boolean;
  authRequired: boolean;
  error?: string;
};

export type DiscoverInstancesResponse = {
  items: DiscoverInstanceItem[];
};

export type DashboardInstanceErrorKind =
  | "invalid_credentials"
  | "tls_error"
  | "timeout"
  | "dns_error"
  | "connection_refused"
  | "pihole_response_error"
  | "unknown";

export type DashboardOverviewResponse = {
  scope: {
    mode: "all" | "instance";
    instanceId: string | null;
    instanceName: string | null;
  };
  summary: {
    totalQueries: number;
    queriesBlocked: number;
    percentageBlocked: number;
    domainsOnList: number;
  };
  charts: {
    totalQueries: {
      points: Array<{
        timestamp: string;
        totalQueries: number;
        cachedQueries: number;
        blockedQueries: number;
        forwardedQueries: number;
        percentageBlocked: number;
      }>;
    };
    clientActivity: {
      series: Array<{
        key: string;
        label: string;
        totalQueries: number;
        points: Array<{
          timestamp: string;
          queries: number;
        }>;
      }>;
    };
  };
  sources: {
    totalInstances: number;
    successfulInstances: Array<{
      instanceId: string;
      instanceName: string;
    }>;
    failedInstances: Array<{
      instanceId: string;
      instanceName: string;
      kind: DashboardInstanceErrorKind;
      message: string;
    }>;
  };
};

export type SyncBlockingAggregateStatus = "enabled" | "disabled" | "mixed" | "partial";

export type SyncBlockingPresetItem = {
  id: string;
  name: string;
  timerSeconds: number;
  sortOrder: number;
};

export type SyncBlockingInstanceStatus = {
  instanceId: string;
  instanceName: string;
  instanceAddress: string;
  blocking: "enabled" | "disabled" | null;
  timerSeconds: number | null;
  reachable: boolean;
  message?: string;
};

export type SyncBlockingStatusResponse = {
  aggregate: {
    status: SyncBlockingAggregateStatus;
    timerSeconds: number | null;
  };
  instances: SyncBlockingInstanceStatus[];
  presets: SyncBlockingPresetItem[];
};

export type SyncBlockingPreviewResponse = {
  desiredConfig: {
    blocking: boolean;
    timerSeconds: number | null;
  };
  aggregate: {
    status: SyncBlockingAggregateStatus;
    timerSeconds: number | null;
  };
  readyInstances: Array<{
    instanceId: string;
    instanceName: string;
    blocking: "enabled" | "disabled";
    timerSeconds: number | null;
  }>;
  noopInstances: Array<{
    instanceId: string;
    instanceName: string;
    blocking: "enabled" | "disabled";
    timerSeconds: number | null;
  }>;
  failedInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: DashboardInstanceErrorKind;
    message: string;
  }>;
};

export type SyncBlockingApplyResponse = {
  job: {
    id: string;
    operationKey: "BLOCKING";
    status: "SUCCESS" | "PARTIAL" | "FAILURE";
    startedAt: string;
    finishedAt: string | null;
  };
  summary: {
    successfulCount: number;
    failedCount: number;
    noopCount: number;
    skippedCount: number;
    totalInstances: number;
  };
  instances: Array<{
    instanceId: string;
    instanceName: string;
    status: "SUCCESS" | "FAILURE" | "NOOP" | "SKIPPED";
    message: string | null;
    blocking: "enabled" | "disabled" | null;
    timerSeconds: number | null;
  }>;
};

export type YapdSession = AppSession;
