import type { AppSession } from "@/components/yapd/app-session-provider";

export type SetupCredentialMode = "shared" | "individual";

export type SetupLoginMode = "pihole-master" | "yapd-password";

export type BaselineSummary = {
  id: string;
  name: string;
  baseUrl: string;
};

export type InstanceTrustMode = "STRICT" | "CUSTOM_CA" | "ALLOW_SELF_SIGNED";

export type SetupStatus = {
  needsSetup: boolean;
  baselineConfigured: boolean;
  loginMode: SetupLoginMode | null;
  timeZone: string;
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
  timeZone?: string;
};

export type SetupBaselineResponse = {
  message: string;
  baseline: (BaselineSummary & { version: string }) | null;
  createdCount: number;
  loginMode: SetupLoginMode;
  timeZone: string;
};

export type InstanceItem = {
  id: string;
  name: string;
  baseUrl: string;
  isBaseline: boolean;
  syncEnabled: boolean;
  lastKnownVersion: string | null;
  lastValidatedAt: string | null;
  trustMode: InstanceTrustMode;
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

export type InstanceDetailResponse = {
  instance: {
    id: string;
    name: string;
    baseUrl: string;
    isBaseline: boolean;
    syncEnabled: boolean;
    trustMode: InstanceTrustMode;
    hasCustomCertificate: boolean;
    allowSelfSigned: boolean;
    certificatePem: string | null;
  };
};

export type InstanceMutationResponse = {
  instance: {
    id: string;
    name: string;
    baseUrl: string;
    version: string;
  };
};

export type InstanceSyncToggleResponse = {
  instance: {
    id: string;
    name: string;
    syncEnabled: boolean;
  };
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

export type InstanceTestResponse = {
  ok: true;
  version: string;
  checkedAt: string;
};

export type InstanceReauthenticateResponse = {
  ok: true;
  version: string;
  checkedAt: string;
  sessionStatus: InstanceItem["sessionStatus"];
  sessionLoginAt: string | null;
  sessionLastActiveAt: string | null;
  sessionValidUntil: string | null;
};

export type GroupItem = {
  name: string;
  comment: string | null;
  enabled: boolean;
  id: number;
  dateAdded: number | null;
  dateModified: number | null;
  origin: {
    instanceId: string;
    instanceName: string;
  };
  sync: {
    isFullySynced: boolean;
    sourceInstances: Array<{
      instanceId: string;
      instanceName: string;
    }>;
    missingInstances: Array<{
      instanceId: string;
      instanceName: string;
    }>;
  };
};

export type GroupsListResponse = {
  items: GroupItem[];
  source: {
    baselineInstanceId: string;
    baselineInstanceName: string;
    totalInstances: number;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
  };
  unavailableInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: DashboardInstanceErrorKind;
    message: string;
  }>;
};

export type GroupsMutationResponse = {
  status: "success" | "partial";
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
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

export type ClientsSortField = "client" | "instance" | "group" | "firstSeen" | "lastQuery" | "numQueries" | "comment";

export type ClientsSortDirection = "asc" | "desc";

export type ClientInstanceDetail = {
  instanceId: string;
  instanceName: string;
  ips: string[];
  firstSeen: string | null;
  lastQuery: string | null;
  numQueries: number;
};

export type ClientListItem = {
  hwaddr: string;
  alias: string | null;
  macVendor: string | null;
  ips: string[];
  instance: {
    instanceId: string;
    instanceName: string;
  };
  visibleInInstances: Array<{
    instanceId: string;
    instanceName: string;
  }>;
  instanceDetails: ClientInstanceDetail[];
  firstSeen: string | null;
  lastQuery: string | null;
  numQueries: number;
  comment: string | null;
  groupIds: number[];
  groupNames: string[];
};

export type ClientsListResponse = {
  items: ClientListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  source: {
    baselineInstanceId: string;
    baselineInstanceName: string;
    totalInstances: number;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
  };
  unavailableInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: DashboardInstanceErrorKind;
    message: string;
  }>;
};

export type ClientsMutationResponse = {
  status: "success" | "partial";
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
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

export type QueriesResponse = {
  queries: Array<{
    instanceId: string;
    instanceName: string;
    id: number;
    time: string;
    type: string | null;
    status: string | null;
    dnssec: string | null;
    domain: string | null;
    upstream: string | null;
    reply: {
      type: string | null;
      time: number | null;
    } | null;
    client: {
      ip: string | null;
      name: string | null;
    } | null;
    listId: number | null;
    ede: {
      code: number | null;
      text: string | null;
    } | null;
    cname: string | null;
  }>;
  cursor: number | null;
  recordsTotal: number;
  recordsFiltered: number;
  earliestTimestamp: string | null;
  earliestTimestampDisk: string | null;
  took: number;
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

export type QuerySuggestionsResponse = {
  suggestions: {
    domain: string[];
    client_ip: string[];
    client_name: string[];
    upstream: string[];
    type: string[];
    status: string[];
    reply: string[];
    dnssec: string[];
  };
  took: number;
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

export type DomainOperationResponse = {
  request: {
    type: "allow" | "deny";
    kind: "exact" | "regex";
    domain: string;
    value: string;
    comment: string;
    scope: "all" | "instance";
    instanceId: string | null;
  };
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: Array<{
    instanceId: string;
    instanceName: string;
    processed: {
      errors: Array<{
        item: string | null;
        message: string | null;
      }>;
      success: Array<{
        item: string | null;
      }>;
    };
    took: number | null;
  }>;
  failedInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: DashboardInstanceErrorKind;
    message: string;
  }>;
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
