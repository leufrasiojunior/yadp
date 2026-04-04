import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { normalizeTimeZone } from "@/lib/i18n/config";

export const QUERY_PAGE_SIZE_OPTIONS = FRONTEND_CONFIG.queries.pageSizeOptions;
export const DEFAULT_QUERIES_LENGTH = FRONTEND_CONFIG.queries.defaultPageSize;
export const MAX_QUERIES_LENGTH = FRONTEND_CONFIG.queries.maxPageSize;

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

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string) {
  const cached = timeZoneFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  timeZoneFormatterCache.set(timeZone, formatter);
  return formatter;
}

function parseDatetimeLocalParts(value: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const match = DATETIME_LOCAL_PATTERN.exec(normalizedValue);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  } satisfies DateTimeParts;

  if (
    !Number.isFinite(parts.year) ||
    !Number.isFinite(parts.month) ||
    !Number.isFinite(parts.day) ||
    !Number.isFinite(parts.hour) ||
    !Number.isFinite(parts.minute) ||
    !Number.isFinite(parts.second)
  ) {
    return null;
  }

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return null;
  }

  return parts;
}

function getDateTimeParts(date: Date, timeZone: string): DateTimeParts {
  const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

function toUtcMilliseconds(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function isSameDateTimeParts(left: DateTimeParts, right: DateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function getTimeZoneOffsetMilliseconds(epochMilliseconds: number, timeZone: string) {
  const parts = getDateTimeParts(new Date(epochMilliseconds), timeZone);
  return toUtcMilliseconds(parts) - epochMilliseconds;
}

export function datetimeLocalToUnixSeconds(value: string, timeZone: string) {
  const parts = parseDatetimeLocalParts(value);

  if (!parts) {
    return undefined;
  }

  const resolvedTimeZone = normalizeTimeZone(timeZone);
  const localAsUtc = toUtcMilliseconds(parts);
  let candidate = localAsUtc;

  for (let index = 0; index < 4; index += 1) {
    const nextCandidate = localAsUtc - getTimeZoneOffsetMilliseconds(candidate, resolvedTimeZone);

    if (nextCandidate === candidate) {
      break;
    }

    candidate = nextCandidate;
  }

  if (isSameDateTimeParts(getDateTimeParts(new Date(candidate), resolvedTimeZone), parts)) {
    return Math.floor(candidate / 1000);
  }

  for (const offset of [-60 * 60 * 1000, 60 * 60 * 1000]) {
    const adjustedCandidate = candidate + offset;

    if (isSameDateTimeParts(getDateTimeParts(new Date(adjustedCandidate), resolvedTimeZone), parts)) {
      return Math.floor(adjustedCandidate / 1000);
    }
  }

  return undefined;
}

export function unixSecondsToDatetimeLocal(value: string | number | null | undefined, timeZone: string) {
  if (value === null || value === undefined) {
    return "";
  }

  const numericValue = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  const resolvedTimeZone = normalizeTimeZone(timeZone);
  const parts = getDateTimeParts(new Date(numericValue * 1000), resolvedTimeZone);
  const year = `${parts.year}`.padStart(4, "0");
  const month = `${parts.month}`.padStart(2, "0");
  const day = `${parts.day}`.padStart(2, "0");
  const hours = `${parts.hour}`.padStart(2, "0");
  const minutes = `${parts.minute}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
