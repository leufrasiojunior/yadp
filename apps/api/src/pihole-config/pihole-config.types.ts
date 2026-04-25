import type {
  PiholeConfigDetailedTopic,
  PiholeConfigOptionFlags,
  PiholeConfigTopicName,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";

export const CONFIG_SYNC_STATUSES = ["synced", "drifted", "partial"] as const;
export const CONFIG_MUTATION_STATUSES = ["success", "partial"] as const;

export type ConfigSyncStatus = (typeof CONFIG_SYNC_STATUSES)[number];
export type ConfigMutationStatus = (typeof CONFIG_MUTATION_STATUSES)[number];

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
  flags: PiholeConfigOptionFlags;
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
  topic: PiholeConfigTopicName;
  fieldPath: string;
};

export type ConfigDriftItem = {
  topic: PiholeConfigTopicName;
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
  kind: PiholeRequestErrorKind;
  message: string;
};

export type ConfigTopicData = {
  name: PiholeConfigTopicName;
  title: string;
  description: string | null;
  value: unknown;
  detailed: PiholeConfigDetailedTopic;
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
  status: ConfigMutationStatus;
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: ConfigInstanceSummary[];
  failedInstances: ConfigInstanceFailure[];
};
