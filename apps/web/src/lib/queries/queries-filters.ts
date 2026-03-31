export const QUERY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000] as const;
export const DEFAULT_QUERIES_LENGTH = 10;
export const MAX_QUERIES_LENGTH = 1000;

export type QueryFilters = {
  from: string;
  until: string;
  length: number;
  start: number;
  domain: string;
  clientIp: string;
  upstream: string;
  type: string;
  status: string;
  reply: string;
  dnssec: string;
  disk: boolean;
};

export function createDefaultQueryFilters(): QueryFilters {
  return {
    from: "",
    until: "",
    length: DEFAULT_QUERIES_LENGTH,
    start: 0,
    domain: "",
    clientIp: "",
    upstream: "",
    type: "",
    status: "",
    reply: "",
    dnssec: "",
    disk: false,
  };
}

export function clampQueryLength(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_QUERIES_LENGTH;
  }

  return Math.max(1, Math.min(MAX_QUERIES_LENGTH, Math.floor(value)));
}

export function normalizeQueryPageSize(value: number) {
  return QUERY_PAGE_SIZE_OPTIONS.includes(value as (typeof QUERY_PAGE_SIZE_OPTIONS)[number])
    ? value
    : DEFAULT_QUERIES_LENGTH;
}

export function trimOrEmpty(value: string) {
  return value.trim();
}

export function datetimeLocalToUnixSeconds(value: string) {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  const timestamp = parsed.getTime();

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return Math.floor(timestamp / 1000);
}

export function unixSecondsToDatetimeLocal(value?: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const numericValue = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  const date = new Date(numericValue * 1000);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
