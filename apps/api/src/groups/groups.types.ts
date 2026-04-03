import type { PiholeRequestErrorKind } from "../pihole/pihole.types";

export const GROUP_MUTATION_STATUSES = ["success", "partial"] as const;

export type GroupMutationStatus = (typeof GROUP_MUTATION_STATUSES)[number];

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
    sourceInstances: GroupsMutationInstanceSource[];
    missingInstances: GroupsMutationInstanceSource[];
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
  unavailableInstances: GroupsMutationInstanceFailure[];
};

export type GroupsMutationInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type GroupsMutationInstanceFailure = GroupsMutationInstanceSource & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type GroupsMutationResponse = {
  status: GroupMutationStatus;
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: GroupsMutationInstanceSource[];
  failedInstances: GroupsMutationInstanceFailure[];
};
