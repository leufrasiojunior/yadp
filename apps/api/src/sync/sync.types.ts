import type {
  PiholeBlockingStatus,
  PiholeManagedInstanceSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";

export const SYNC_OPERATION_KEYS = ["BLOCKING"] as const;

export type SyncOperationKey = (typeof SYNC_OPERATION_KEYS)[number];

export const SYNC_BLOCKING_AGGREGATE_STATUSES = ["enabled", "disabled", "mixed", "partial"] as const;

export type SyncBlockingAggregateStatus = (typeof SYNC_BLOCKING_AGGREGATE_STATUSES)[number];

export const SYNC_BLOCKING_APPLY_RESULT_STATUSES = ["SUCCESS", "FAILURE", "NOOP", "SKIPPED"] as const;

export type SyncBlockingApplyResultStatus = (typeof SYNC_BLOCKING_APPLY_RESULT_STATUSES)[number];

export type SyncBlockingAggregate = {
  status: SyncBlockingAggregateStatus;
  timerSeconds: number | null;
};

export type SyncBlockingPreset = {
  id: string;
  name: string;
  timerSeconds: number;
  sortOrder: number;
};

export type SyncBlockingInstanceStatus = {
  instanceId: string;
  instanceName: string;
  instanceAddress: string;
  blocking: PiholeBlockingStatus | null;
  timerSeconds: number | null;
  reachable: boolean;
  message?: string;
};

export type SyncBlockingInstanceFailure = Pick<PiholeManagedInstanceSummary, "id" | "name"> & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type SyncBlockingStatusResponse = {
  aggregate: SyncBlockingAggregate;
  instances: SyncBlockingInstanceStatus[];
  presets: SyncBlockingPreset[];
};

export type SyncBlockingPreviewInstance = {
  instanceId: string;
  instanceName: string;
  blocking: PiholeBlockingStatus;
  timerSeconds: number | null;
};

export type SyncBlockingPreviewResponse = {
  desiredConfig: {
    blocking: boolean;
    timerSeconds: number | null;
  };
  aggregate: SyncBlockingAggregate;
  readyInstances: SyncBlockingPreviewInstance[];
  noopInstances: SyncBlockingPreviewInstance[];
  failedInstances: Array<{
    instanceId: string;
    instanceName: string;
    kind: PiholeRequestErrorKind;
    message: string;
  }>;
};

export type SyncBlockingApplyResponse = {
  job: {
    id: string;
    operationKey: SyncOperationKey;
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
    status: SyncBlockingApplyResultStatus;
    message: string | null;
    blocking: PiholeBlockingStatus | null;
    timerSeconds: number | null;
  }>;
};
