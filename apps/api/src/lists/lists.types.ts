import type { PiholeListType, PiholeRequestErrorKind } from "../pihole/pihole.types";

export const LIST_MUTATION_STATUSES = ["success", "partial"] as const;
export const DEFAULT_LISTS_PAGE_SIZE = 10;
export const MAX_LISTS_PAGE_SIZE = 100;
export const MAX_LISTS_PAGE = 999;
export const LIST_SORT_FIELDS = ["address", "type", "enabled", "comment", "group"] as const;
export const LIST_SORT_DIRECTIONS = ["asc", "desc"] as const;
export const DEFAULT_LISTS_SORT_FIELD = "address";
export const DEFAULT_LISTS_SORT_DIRECTION = "asc";

export type ListMutationStatus = (typeof LIST_MUTATION_STATUSES)[number];
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];
export type ListSortDirection = (typeof LIST_SORT_DIRECTIONS)[number];

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
