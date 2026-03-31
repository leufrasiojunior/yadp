import type { ApiLocale } from "../common/i18n/locale";

export type PiholeConnection = {
  baseUrl: string;
  allowSelfSigned?: boolean;
  certificatePem?: string | null;
  locale?: ApiLocale;
};

export type PiholeSession = {
  sid: string;
  csrf: string;
  validity: number;
  totp: boolean;
};

export type PiholeAuthSessionTls = {
  login: boolean;
  mixed: boolean;
};

export type PiholeAuthSessionRecord = {
  id: number;
  currentSession: boolean;
  valid: boolean;
  tls: PiholeAuthSessionTls;
  loginAt: number;
  lastActive: number;
  validUntil: number;
  remoteAddr: string | null;
  userAgent: string | null;
  xForwardedFor: string | null;
  app: boolean;
  cli: boolean;
};

export type PiholeVersionInfo = {
  summary: string;
  raw: unknown;
};

export type PiholeDiscoveryResult = {
  baseUrl: string;
  authRequired: boolean;
  raw: unknown;
};

export const PIHOLE_REQUEST_ERROR_KINDS = [
  "invalid_credentials",
  "tls_error",
  "timeout",
  "dns_error",
  "connection_refused",
  "pihole_response_error",
  "unknown",
] as const;

export type PiholeRequestErrorKind = (typeof PIHOLE_REQUEST_ERROR_KINDS)[number];

export type PiholeManagedInstanceSummary = {
  id: string;
  name: string;
  baseUrl: string;
};

export type PiholeBlockingStatus = "enabled" | "disabled";

export type PiholeBlockingConfig = {
  blocking: PiholeBlockingStatus;
  timer: number | null;
  took: number;
};

export type PiholeBlockingRequest = {
  blocking: boolean;
  timer: number | null;
};

export type PiholeMetricsSummary = {
  totalQueries: number;
  queriesBlocked: number;
  percentageBlocked: number;
  domainsOnList: number;
};

export type PiholeHistoryPoint = {
  timestamp: number;
  totalQueries: number;
  cachedQueries: number;
  blockedQueries: number;
  forwardedQueries: number;
};

export type PiholeHistoryBucket = {
  timestamp: number;
  total: number;
  cached: number;
  blocked: number;
  forwarded: number;
};

export type PiholeClientActivityPoint = {
  timestamp: number;
  queries: number;
};

export type PiholeClientActivitySeries = {
  key: string;
  label: string;
  totalQueries: number;
  points: PiholeClientActivityPoint[];
};

export type PiholeClientHistoryBucket = {
  timestamp: number;
  data: Record<string, number>;
};

export type PiholeQueryListRequest = {
  from?: number;
  until?: number;
  length?: number;
  start?: number;
  cursor?: number;
  domain?: string;
  clientIp?: string;
  upstream?: string;
  type?: string;
  status?: string;
  reply?: string;
  dnssec?: string;
  disk?: boolean;
};

export type PiholeQueryLogReply = {
  type: string | null;
  time: number | null;
};

export type PiholeQueryLogClient = {
  ip: string | null;
  name: string | null;
};

export type PiholeQueryLogEde = {
  code: number | null;
  text: string | null;
};

export type PiholeQueryLogEntry = {
  id: number;
  time: number;
  type: string | null;
  status: string | null;
  dnssec: string | null;
  domain: string | null;
  upstream: string | null;
  reply: PiholeQueryLogReply | null;
  client: PiholeQueryLogClient | null;
  listId: number | null;
  ede: PiholeQueryLogEde | null;
  cname: string | null;
};

export type PiholeQueryListResult = {
  queries: PiholeQueryLogEntry[];
  cursor: number | null;
  recordsTotal: number;
  recordsFiltered: number;
  earliestTimestamp: number | null;
  earliestTimestampDisk: number | null;
  took: number | null;
};

export const PIHOLE_QUERY_SUGGESTION_KEYS = [
  "domain",
  "client_ip",
  "client_name",
  "upstream",
  "type",
  "status",
  "reply",
  "dnssec",
] as const;

export type PiholeQuerySuggestionKey = (typeof PIHOLE_QUERY_SUGGESTION_KEYS)[number];

export type PiholeQuerySuggestions = Record<PiholeQuerySuggestionKey, string[]>;

export type PiholeQuerySuggestionsResult = {
  suggestions: PiholeQuerySuggestions;
  took: number | null;
};
