import type { PiholeQuerySuggestions, PiholeRequestErrorKind } from "../pihole/pihole.types";

export const QUERIES_SCOPE_VALUES = ["all", "instance"] as const;
export const DEFAULT_QUERIES_LENGTH = 10;
export const MAX_QUERIES_LENGTH = 1000;
export const MAX_QUERIES_START = 1000;
export const MAX_QUERY_INSTANCE_CONCURRENCY = 3;

export type QueriesScopeMode = (typeof QUERIES_SCOPE_VALUES)[number];

export type QueriesInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type QueriesInstanceFailure = QueriesInstanceSource & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type QueryLogRecord = {
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
};

export type QueriesResponse = {
  queries: QueryLogRecord[];
  cursor: number | null;
  recordsTotal: number;
  recordsFiltered: number;
  earliestTimestamp: string | null;
  earliestTimestampDisk: string | null;
  took: number;
  sources: {
    totalInstances: number;
    successfulInstances: QueriesInstanceSource[];
    failedInstances: QueriesInstanceFailure[];
  };
};

export type QuerySuggestionsResponse = {
  suggestions: PiholeQuerySuggestions;
  took: number;
  sources: {
    totalInstances: number;
    successfulInstances: QueriesInstanceSource[];
    failedInstances: QueriesInstanceFailure[];
  };
};
