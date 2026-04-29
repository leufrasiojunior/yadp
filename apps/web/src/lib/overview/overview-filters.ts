import { datetimeLocalToUnixSeconds, unixSecondsToDatetimeLocal } from "@/lib/queries/queries-filters";

export const OVERVIEW_TAB_VALUES = ["request", "ranking", "jobs"] as const;
export type OverviewTab = (typeof OVERVIEW_TAB_VALUES)[number];

export type OverviewFilters = {
  from: string;
  until: string;
};

export function normalizeOverviewTab(searchParams: Record<string, string | string[] | undefined>): OverviewTab {
  const tab = searchParams.tab;
  const value = Array.isArray(tab) ? (tab[0] ?? "") : (tab ?? "");
  return value === "ranking" || value === "jobs" ? value : "request";
}

export function buildDefaultOverviewFilters(timeZone: string): OverviewFilters {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 0, 0);
  const sixDaysBefore = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);

  return {
    from: unixSecondsToDatetimeLocal(Math.floor(sixDaysBefore.getTime() / 1000), timeZone),
    until: unixSecondsToDatetimeLocal(Math.floor(yesterday.getTime() / 1000), timeZone),
  };
}

export function buildOverviewQueryFromFilters(filters: OverviewFilters, timeZone: string) {
  const from = datetimeLocalToUnixSeconds(filters.from, timeZone);
  const until = datetimeLocalToUnixSeconds(filters.until, timeZone);

  return {
    ...(from !== undefined ? { from } : {}),
    ...(until !== undefined ? { until } : {}),
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

  return {
    from: read("from") || defaults.from,
    until: read("until") || defaults.until,
  };
}
