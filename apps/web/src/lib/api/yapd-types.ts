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

export type InstanceVersionComponentRelease = {
  version: string | null;
  branch: string | null;
  hash: string | null;
  date: string | null;
};

export type InstanceVersionComponentInfo = {
  local: InstanceVersionComponentRelease | null;
  remote: InstanceVersionComponentRelease | null;
} | null;

export type InstanceMemoryInfo = {
  total: number | null;
  free: number | null;
  used: number | null;
  available: number | null;
  percentUsed: number | null;
} | null;

export type InstanceInfoResponse = {
  instanceId: string;
  fetchedAt: string;
  version: {
    summary: string;
    core: InstanceVersionComponentInfo;
    web: InstanceVersionComponentInfo;
    ftl: InstanceVersionComponentInfo;
    docker: InstanceVersionComponentInfo;
  };
  host: {
    model: string | null;
    nodename: string | null;
    machine: string | null;
    sysname: string | null;
    release: string | null;
    version: string | null;
    domainname: string | null;
  };
  system: {
    uptime: number | null;
    memory: {
      ram: InstanceMemoryInfo;
      swap: InstanceMemoryInfo;
    };
    procs: number | null;
    cpu: {
      nprocs: number | null;
      percentCpu: number | null;
      load: {
        raw: number[] | null;
        percent: number[] | null;
      } | null;
    } | null;
    ftl: {
      percentMem: number | null;
      percentCpu: number | null;
    } | null;
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

export type InstancePrimaryMutationResponse = {
  instance: {
    id: string;
    name: string;
    isBaseline: boolean;
    syncEnabled: boolean;
  };
  previousBaselineId: string | null;
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
  summary: {
    totalItems: number;
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

export type NavigationSummaryResponse = {
  groups: {
    total: number;
  };
  lists: {
    total: number;
  };
  domains: {
    total: number;
  };
};

export type NotificationSource = "PIHOLE" | "SYSTEM";
export type NotificationState = "ACTIVE" | "RESOLVED";
export type NotificationReadState = "unread" | "read";
export type NotificationMetadata = Record<string, unknown> | null;

export type NotificationItem = {
  id: string;
  source: NotificationSource;
  type:
    | "RATE_LIMIT"
    | "CONNECTION_ERROR"
    | "CLIENTS_FAILURE"
    | "DOMAINS_FAILURE"
    | "GROUPS_FAILURE"
    | "INSTANCES_FAILURE"
    | "LISTS_FAILURE"
    | "NOTIFICATION_SYNC_ERROR"
    | "INSTANCE_SESSION_ERROR"
    | "SYNC_FAILURE"
    | "SYSTEM_FAILURE"
    | string;
  title: string;
  instanceId: string | null;
  instanceName: string | null;
  message: string;
  metadata: NotificationMetadata;
  state: NotificationState;
  isRead: boolean;
  readAt: string | null;
  hiddenAt: string | null;
  resolvedAt: string | null;
  occurredAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  canDeleteRemotely: boolean;
};

export type NotificationsListResponse = {
  items: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  unreadCount: number;
  readState: NotificationReadState;
};

export type NotificationsPreviewResponse = {
  items: NotificationItem[];
  unreadCount: number;
  push: {
    available: boolean;
  };
};

export type NotificationMutationResponse = {
  notification: NotificationItem;
};

export type NotificationReadAllResponse = {
  updatedCount: number;
};

export type PushPublicKeyResponse = {
  available: boolean;
  publicKey: string | null;
  source: "env" | "database" | null;
};

export type PushSubscriptionBody = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
};

export type PushSubscriptionResponse = {
  ok: true;
  available: boolean;
  endpoint: string;
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
  tags: string[];
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
  availableTags: string[];
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

export type OverviewResponse = {
  scope: {
    mode: "all" | "instance";
    instanceId: string | null;
    instanceName: string | null;
  };
  filters: {
    from: string;
    until: string;
    groupBy: "hour" | "day";
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
      groupBy: "hour" | "day";
      points: Array<{
        timestamp: string;
        totalQueries: number;
        blockedQueries: number;
        cachedQueries: number;
        forwardedQueries: number;
        percentageBlocked: number;
      }>;
    };
  };
  rankings: {
    domains: Array<{
      value: string;
      count: number;
    }>;
    clients: Array<{
      value: string;
      count: number;
    }>;
    upstreams: Array<{
      value: string;
      count: number;
    }>;
    statuses: Array<{
      value: string;
      count: number;
    }>;
  };
  coverage: {
    hasAnyData: boolean;
    requestedFrom: string;
    requestedUntil: string;
    totalStoredQueries: number;
    earliestStoredAt: string | null;
    latestStoredAt: string | null;
    windows: Array<{
      id: string;
      jobId: string | null;
      instanceId: string;
      instanceName: string;
      requestedFrom: string;
      requestedUntil: string;
      storedFrom: string | null;
      storedUntil: string | null;
      rowCount: number;
      status: "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILURE";
      errorMessage: string | null;
      expiresAt: string;
    }>;
  };
  sources: {
    totalInstances: number;
    availableInstances: Array<{
      instanceId: string;
      instanceName: string;
    }>;
    failedInstances: Array<{
      instanceId: string;
      instanceName: string;
      kind: "missing_data" | "import_failure";
      message: string;
    }>;
  };
};

export type OverviewJobsResponse = {
  jobs: Array<{
    id: string;
    kind: "AUTOMATIC_IMPORT" | "MANUAL_IMPORT" | "MANUAL_DELETE";
    scope: "all" | "instance";
    instanceId: string | null;
    instanceName: string | null;
    requestedFrom: string;
    requestedUntil: string;
    status: "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILURE";
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
  }>;
};

export type OverviewMutationResponse = {
  job: OverviewJobsResponse["jobs"][number];
};

export type OverviewJobDeleteResponse = {
  job: OverviewJobsResponse["jobs"][number];
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
      alias: string | null;
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

export type QueryGroupMembershipRefreshResponse = {
  updatedAt: string | null;
  summary: {
    totalInstances: number;
    refreshedInstances: number;
    failedInstances: number;
    groupsCached: number;
    membershipsCached: number;
    instancesNeedingReview: number;
  };
  requiresGroupReview: boolean;
  reviewPath: "/groups";
  failedInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: DashboardInstanceErrorKind;
    message: string;
  }>;
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
  groupOptions: Array<{
    id: number;
    name: string;
  }>;
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
    patternMode: DomainPatternMode | null;
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

export type ListItem = {
  address: string;
  comment: string | null;
  enabled: boolean;
  groups: number[];
  id: number;
  dateAdded: number | null;
  dateModified: number | null;
  type: "allow" | "block";
  dateUpdated: number | null;
  number: number | null;
  invalidDomains: number | null;
  abpEntries: number | null;
  status: number | null;
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

export type ListsSortField = "address" | "type" | "enabled" | "comment" | "group";

export type ListsSortDirection = "asc" | "desc";

export type ListsListResponse = {
  items: ListItem[];
  summary: {
    totalItems: number;
  };
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

export type ListsMutationResponse = {
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

export type DomainFilterValue = "exact-allow" | "regex-allow" | "exact-deny" | "regex-deny";

export type DomainPatternMode = "exact" | "regex_specific" | "regex_any";

export type DomainsSortField = "domain" | "type" | "kind" | "enabled" | "comment" | "group";

export type DomainsSortDirection = "asc" | "desc";

export type DomainItem = {
  domain: string;
  unicode: string | null;
  type: "allow" | "deny";
  kind: "exact" | "regex";
  comment: string | null;
  enabled: boolean;
  groups: number[];
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

export type DomainsListResponse = {
  items: DomainItem[];
  summary: {
    totalItems: number;
    allowTotal: number;
    denyTotal: number;
    allowExact: number;
    allowRegex: number;
    denyExact: number;
    denyRegex: number;
  };
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

export type DomainsMutationResponse = {
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

export type DomainsImportResponse = {
  status: "success" | "partial";
  summary: {
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    invalidCount: number;
  };
  errors: Array<{
    line: number;
    message: string;
  }>;
};

export type ConfigTopicName =
  | "dns"
  | "dhcp"
  | "ntp"
  | "resolver"
  | "database"
  | "webserver"
  | "files"
  | "misc"
  | "debug";

export type ConfigSyncStatus = "synced" | "drifted" | "partial";

export type ConfigFieldItem = {
  path: string;
  key: string;
  groupPath: string | null;
  description: string | null;
  allowed: unknown;
  type: string | null;
  value: unknown;
  defaultValue: unknown;
  modified: boolean;
  flags: {
    restart_dnsmasq: boolean;
    session_reset: boolean;
    env_var: boolean;
  };
  isIgnored: boolean;
  ignoreRuleId: string | null;
  sync: {
    status: ConfigSyncStatus;
    isFullySynced: boolean;
    sourceInstances: ConfigInstanceSummary[];
    missingInstances: ConfigInstanceSummary[];
  };
};

export type ConfigIgnoredField = {
  id: string;
  topic: ConfigTopicName;
  fieldPath: string;
};

export type ConfigDriftItem = {
  topic: ConfigTopicName;
  topicTitle: string;
  fieldPath: string;
  fieldKey: string;
  groupPath: string | null;
};

export type ConfigInstanceSummary = {
  instanceId: string;
  instanceName: string;
  isBaseline: boolean;
  syncEnabled: boolean;
};

export type ConfigInstanceFailure = ConfigInstanceSummary & {
  kind: DashboardInstanceErrorKind;
  message: string;
};

export type ConfigTopicData = {
  name: ConfigTopicName;
  title: string;
  description: string | null;
  value: unknown;
  detailed: Record<string, unknown>;
  fields: ConfigFieldItem[];
  sync: {
    status: ConfigSyncStatus;
    isFullySynced: boolean;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
    sourceInstances: ConfigInstanceSummary[];
    missingInstances: ConfigInstanceSummary[];
  };
};

export type ConfigOverviewResponse = {
  topics: ConfigTopicData[];
  driftItems: ConfigDriftItem[];
  ignoredFields: ConfigIgnoredField[];
  source: {
    baselineInstanceId: string;
    baselineInstanceName: string;
    defaultSourceInstanceId: string;
    defaultSourceInstanceName: string;
    totalInstances: number;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
  };
  instances: ConfigInstanceSummary[];
  unavailableInstances: ConfigInstanceFailure[];
};

export type ConfigTopicResponse = {
  topic: ConfigTopicData;
  sourceInstance: ConfigInstanceSummary;
};

export type ConfigUpdateResponse = ConfigTopicResponse;

export type ConfigIgnoreRuleResponse = {
  rule: ConfigIgnoredField;
};

export type ConfigMutationResponse = {
  status: "success" | "partial";
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: ConfigInstanceSummary[];
  failedInstances: ConfigInstanceFailure[];
};

export type YapdSession = AppSession;
