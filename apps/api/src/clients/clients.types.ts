import type { PiholeRequestErrorKind } from "../pihole/pihole.types";

export const CLIENT_MUTATION_STATUSES = ["success", "partial"] as const;
export const DEFAULT_CLIENTS_PAGE_SIZE = 10;
export const MAX_CLIENTS_PAGE_SIZE = 100;
export const MAX_CLIENTS_PAGE = 999;
export const CLIENT_LIST_SORT_FIELDS = [
  "client",
  "instance",
  "group",
  "firstSeen",
  "lastQuery",
  "numQueries",
  "comment",
] as const;
export const CLIENT_LIST_SORT_DIRECTIONS = ["asc", "desc"] as const;
export const DEFAULT_CLIENTS_SORT_FIELD = "numQueries";
export const DEFAULT_CLIENTS_SORT_DIRECTION = "desc";

export type ClientMutationStatus = (typeof CLIENT_MUTATION_STATUSES)[number];
export type ClientListSortField = (typeof CLIENT_LIST_SORT_FIELDS)[number];
export type ClientListSortDirection = (typeof CLIENT_LIST_SORT_DIRECTIONS)[number];

export type ClientsMutationInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type ClientsMutationInstanceFailure = ClientsMutationInstanceSource & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type ClientInstanceDetail = ClientsMutationInstanceSource & {
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
  instance: ClientsMutationInstanceSource;
  visibleInInstances: ClientsMutationInstanceSource[];
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
  unavailableInstances: ClientsMutationInstanceFailure[];
};

export type ClientsMutationResponse = {
  status: ClientMutationStatus;
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: ClientsMutationInstanceSource[];
  failedInstances: ClientsMutationInstanceFailure[];
};
