import { datetimeLocalToUnixSeconds, unixSecondsToDatetimeLocal } from "@/lib/queries/queries-filters";

export const OVERVIEW_TAB_VALUES = ["request", "ranking", "jobs"] as const;
export type OverviewTab = (typeof OVERVIEW_TAB_VALUES)[number];
export const OVERVIEW_GROUP_BY_VALUES = ["hour", "day"] as const;
export type OverviewGroupBy = (typeof OVERVIEW_GROUP_BY_VALUES)[number];

export type OverviewFilters = {
  from: string;
  until: string;
  domain: string;
  client_ip: string;
  groupBy: OverviewGroupBy;
};

function parseDateOnly(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return { year, month, day };
}

function formatDateOnly(parts: { year: number; month: number; day: number }) {
  const year = `${parts.year}`.padStart(4, "0");
  const month = `${parts.month}`.padStart(2, "0");
  const day = `${parts.day}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDateOnly(value: string, days: number) {
  const parts = parseDateOnly(value);

  if (!parts) {
    return value;
  }

  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return formatDateOnly({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function getCurrentDateInTimeZone(timeZone: string) {
  const zonedNow = unixSecondsToDatetimeLocal(Math.floor(Date.now() / 1000), timeZone);
  return zonedNow.slice(0, 10);
}

function normalizeDateTimeDate(value: string, fallback: string) {
  const date = value.slice(0, 10);

  return parseDateOnly(date) ? date : fallback;
}

function normalizeDateTimeTime(value: string, fallback: string) {
  const time = value.slice(11, 16);

  return /^\d{2}:\d{2}$/.test(time) ? time : fallback;
}

function normalizeTimeValue(value: string, fallback: string) {
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

export function getOverviewMaxSelectableDateTime(timeZone: string) {
  return `${shiftDateOnly(getCurrentDateInTimeZone(timeZone), -1)}T23:59`;
}

export function clampOverviewRequestFiltersToSingleDay(
  filters: OverviewFilters,
  maxSelectableDateTime: string,
): OverviewFilters {
  const maxDate = maxSelectableDateTime.slice(0, 10);
  const requestedDate = normalizeDateTimeDate(filters.from, maxDate);
  const day = requestedDate > maxDate ? maxDate : requestedDate;
  const from = `${day}T${normalizeDateTimeTime(filters.from, "00:00")}`;
  const untilDate = normalizeDateTimeDate(filters.until, day);
  const untilTime = untilDate === day ? normalizeDateTimeTime(filters.until, "23:59") : "23:59";
  const until = `${day}T${untilTime}`;

  const normalizedFrom = from > maxSelectableDateTime ? `${day}T00:00` : from;
  const normalizedUntil = until > maxSelectableDateTime ? maxSelectableDateTime : until;

  return {
    ...filters,
    from: normalizedFrom,
    until: normalizedUntil < normalizedFrom ? normalizedFrom : normalizedUntil,
  };
}

export function buildOverviewSingleDayFilters(
  filters: OverviewFilters,
  date: string,
  fromTime: string,
  untilTime: string,
  maxSelectableDateTime: string,
): OverviewFilters {
  const maxDate = maxSelectableDateTime.slice(0, 10);
  const day = parseDateOnly(date) && date <= maxDate ? date : maxDate;
  const from = `${day}T${normalizeTimeValue(fromTime, "00:00")}`;
  const until = `${day}T${normalizeTimeValue(untilTime, "23:59")}`;

  return clampOverviewRequestFiltersToSingleDay(
    {
      ...filters,
      from,
      until: until < from ? from : until,
    },
    maxSelectableDateTime,
  );
}

export function buildOverviewSavedDateRangeFilters(
  filters: OverviewFilters,
  fromDate: string,
  untilDate: string,
): OverviewFilters {
  const from = parseDateOnly(fromDate) ? fromDate : filters.from.slice(0, 10);
  const until = parseDateOnly(untilDate) ? untilDate : filters.until.slice(0, 10);
  const [startDate, endDate] = from <= until ? [from, until] : [until, from];

  return {
    ...filters,
    from: `${startDate}T00:00`,
    until: `${endDate}T23:59`,
    groupBy: "hour",
  };
}

export function buildOverviewRankingRangeFilters(
  filters: OverviewFilters,
  fromDate: string,
  fromTime: string,
  untilDate: string,
  untilTime: string,
): OverviewFilters {
  const fallbackFromDate = normalizeDateTimeDate(filters.from, "1970-01-01");
  const fallbackUntilDate = normalizeDateTimeDate(filters.until, fallbackFromDate);
  const normalizedFromDate = parseDateOnly(fromDate) ? fromDate : fallbackFromDate;
  const normalizedUntilDate = parseDateOnly(untilDate) ? untilDate : fallbackUntilDate;
  const from = `${normalizedFromDate}T${normalizeTimeValue(fromTime, "00:00")}`;
  const until = `${normalizedUntilDate}T${normalizeTimeValue(untilTime, "23:59")}`;
  const [start, end] = from <= until ? [from, until] : [until, from];

  return {
    ...filters,
    from: start,
    until: end,
    groupBy: "hour",
  };
}

function getOverviewChartBucketStart(value: string, groupBy: OverviewGroupBy) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (groupBy === "day") {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  date.setUTCMinutes(0, 0, 0);
  return date;
}

function addOverviewChartBucket(date: Date, groupBy: OverviewGroupBy) {
  const next = new Date(date);

  if (groupBy === "day") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

function getOverviewLocalHour(value: string, timeZone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour");
  const hour = Number(hourPart?.value);

  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export function buildOverviewChartBucketTimestamp(value: string, groupBy: OverviewGroupBy) {
  return getOverviewChartBucketStart(value, groupBy)?.toISOString() ?? null;
}

export function buildOverviewChartBucketTimestamps(
  from: string,
  until: string,
  groupBy: OverviewGroupBy,
  maxBuckets = 5000,
) {
  const firstBucket = getOverviewChartBucketStart(from, groupBy);
  const lastBucket = getOverviewChartBucketStart(until, groupBy);

  if (!firstBucket || !lastBucket || firstBucket > lastBucket || maxBuckets <= 0) {
    return [];
  }

  const timestamps: string[] = [];
  let cursor = firstBucket;

  while (cursor <= lastBucket) {
    if (timestamps.length >= maxBuckets) {
      return [];
    }

    timestamps.push(cursor.toISOString());
    cursor = addOverviewChartBucket(cursor, groupBy);
  }

  return timestamps;
}

export function buildOverviewLocalHourRange(from: string, until: string, timeZone: string) {
  const fromHour = getOverviewLocalHour(from, timeZone);
  const untilHour = getOverviewLocalHour(until, timeZone);

  if (fromHour === null || untilHour === null) {
    return Array.from({ length: 24 }, (_, hour) => hour);
  }

  const hours: number[] = [];
  let cursor = fromHour;

  while (hours.length < 24) {
    hours.push(cursor);

    if (cursor === untilHour) {
      return hours;
    }

    cursor = (cursor + 1) % 24;
  }

  return hours;
}

export function buildOverviewHourBucketFilters(
  filters: OverviewFilters,
  timestamp: string,
  timeZone: string,
): OverviewFilters | null {
  const bucketStartMs = new Date(timestamp).getTime();

  if (!Number.isFinite(bucketStartMs)) {
    return null;
  }

  const from = unixSecondsToDatetimeLocal(Math.floor(bucketStartMs / 1000), timeZone);
  const until = unixSecondsToDatetimeLocal(Math.floor(bucketStartMs / 1000) + 3599, timeZone);

  if (!from || !until) {
    return null;
  }

  return {
    ...filters,
    from,
    until,
    groupBy: "hour",
  };
}

export function normalizeOverviewTab(searchParams: Record<string, string | string[] | undefined>): OverviewTab {
  const tab = searchParams.tab;
  const value = Array.isArray(tab) ? (tab[0] ?? "") : (tab ?? "");
  return value === "ranking" || value === "jobs" ? value : "request";
}

export function buildDefaultOverviewFilters(timeZone: string): OverviewFilters {
  const maxSelectable = getOverviewMaxSelectableDateTime(timeZone);
  const closedDay = maxSelectable.slice(0, 10);

  return {
    from: `${closedDay}T00:00`,
    until: `${closedDay}T23:59`,
    domain: "",
    client_ip: "",
    groupBy: "hour",
  };
}

export function buildOverviewQueryFromFilters(filters: OverviewFilters, timeZone: string) {
  const from = datetimeLocalToUnixSeconds(filters.from, timeZone);
  const until = datetimeLocalToUnixSeconds(filters.until, timeZone);
  const domain = filters.domain.trim();
  const clientIp = filters.client_ip.trim();

  return {
    ...(from !== undefined ? { from } : {}),
    ...(until !== undefined ? { until: until + 59 } : {}),
    groupBy: filters.groupBy,
    ...(domain.length > 0 ? { domain } : {}),
    ...(clientIp.length > 0 ? { client_ip: clientIp } : {}),
  };
}

export function normalizeOverviewFilters(
  searchParams: Record<string, string | string[] | undefined>,
  timeZone: string,
): OverviewFilters {
  const defaults = buildDefaultOverviewFilters(timeZone);
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  const normalizeDateFilter = (value: string, fallback: string) => {
    if (!value) {
      return fallback;
    }

    if (/^\d+$/.test(value)) {
      return unixSecondsToDatetimeLocal(Number(value), timeZone) || fallback;
    }

    return value;
  };
  const normalizeTextFilter = (value: string) => value.trim();
  const normalizeGroupBy = (value: string): OverviewGroupBy => (value === "day" ? "day" : "hour");

  return {
    from: normalizeDateFilter(read("from"), defaults.from),
    until: normalizeDateFilter(read("until"), defaults.until),
    domain: normalizeTextFilter(read("domain")),
    client_ip: normalizeTextFilter(read("client_ip")),
    groupBy: normalizeGroupBy(read("groupBy")),
  };
}
