import { datetimeLocalToUnixSeconds, unixSecondsToDatetimeLocal } from "@/lib/queries/queries-filters";

export const OVERVIEW_TAB_VALUES = ["request", "ranking", "jobs"] as const;
export type OverviewTab = (typeof OVERVIEW_TAB_VALUES)[number];

export type OverviewFilters = {
  from: string;
  until: string;
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

export function getOverviewMaxSelectableDateTime(timeZone: string) {
  return `${shiftDateOnly(getCurrentDateInTimeZone(timeZone), -1)}T23:59`;
}

export function normalizeOverviewTab(searchParams: Record<string, string | string[] | undefined>): OverviewTab {
  const tab = searchParams.tab;
  const value = Array.isArray(tab) ? (tab[0] ?? "") : (tab ?? "");
  return value === "ranking" || value === "jobs" ? value : "request";
}

export function buildDefaultOverviewFilters(timeZone: string): OverviewFilters {
  const maxSelectable = getOverviewMaxSelectableDateTime(timeZone);
  const closedDay = maxSelectable.slice(0, 10);
  const sixDaysBefore = shiftDateOnly(closedDay, -6);

  return {
    from: `${sixDaysBefore}T00:00`,
    until: `${closedDay}T23:59`,
  };
}

export function buildOverviewQueryFromFilters(filters: OverviewFilters, timeZone: string) {
  const from = datetimeLocalToUnixSeconds(filters.from, timeZone);
  const until = datetimeLocalToUnixSeconds(filters.until, timeZone);

  return {
    ...(from !== undefined ? { from } : {}),
    ...(until !== undefined ? { until: until + 59 } : {}),
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

  return {
    from: normalizeDateFilter(read("from"), defaults.from),
    until: normalizeDateFilter(read("until"), defaults.until),
  };
}
