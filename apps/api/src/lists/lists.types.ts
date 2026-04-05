import type { PiholeListType, PiholeRequestErrorKind } from "../pihole/pihole.types";

export const LIST_MUTATION_STATUSES = ["success", "partial"] as const;

export type ListMutationStatus = (typeof LIST_MUTATION_STATUSES)[number];

export type ListItem = {
  address: string;
  comment: string | null;
  enabled: boolean;
  groups: number[];
  id: number;
  dateAdded: number | null;
  dateModified: number | null;
  type: PiholeListType;
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
    sourceInstances: ListsMutationInstanceSource[];
    missingInstances: ListsMutationInstanceSource[];
  };
};

export type ListsListResponse = {
  items: ListItem[];
  source: {
    baselineInstanceId: string;
    baselineInstanceName: string;
    totalInstances: number;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
  };
  unavailableInstances: ListsMutationInstanceFailure[];
};

export type ListsMutationInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type ListsMutationInstanceFailure = ListsMutationInstanceSource & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type ListsMutationResponse = {
  status: ListMutationStatus;
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: ListsMutationInstanceSource[];
  failedInstances: ListsMutationInstanceFailure[];
};
