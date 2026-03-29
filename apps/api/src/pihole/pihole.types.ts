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
