import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const overviewFilters = require("./overview-filters.ts") as {
  buildOverviewChartBucketTimestamp: (value: string, groupBy: "hour" | "day") => string | null;
  buildOverviewChartBucketTimestamps: (
    from: string,
    until: string,
    groupBy: "hour" | "day",
    maxBuckets?: number,
  ) => string[];
  buildOverviewLocalHourRange: (from: string, until: string, timeZone: string) => number[];
  buildDefaultOverviewFilters: (timeZone: string) => {
    from: string;
    until: string;
    domain: string;
    client_ip: string;
    groupBy: "hour" | "day";
  };
  buildOverviewHourBucketFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    timestamp: string,
    timeZone: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" } | null;
  clampOverviewRequestFiltersToSingleDay: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    maxSelectableDateTime: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
  buildOverviewSavedDateRangeFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    fromDate: string,
    untilDate: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
  buildOverviewRankingRangeFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    fromDate: string,
    fromTime: string,
    untilDate: string,
    untilTime: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
  buildOverviewQueryFromFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    timeZone: string,
  ) => { from?: number; until?: number; domain?: string; client_ip?: string; groupBy: "hour" | "day" };
  buildOverviewSingleDayFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    date: string,
    fromTime: string,
    untilTime: string,
    maxSelectableDateTime: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
  getOverviewMaxSelectableDateTime: (timeZone: string) => string;
  normalizeOverviewFilters: (
    searchParams: Record<string, string | string[] | undefined>,
    timeZone: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
};
const {
  buildOverviewChartBucketTimestamp,
  buildOverviewChartBucketTimestamps,
  buildOverviewLocalHourRange,
  buildDefaultOverviewFilters,
  buildOverviewHourBucketFilters,
  buildOverviewQueryFromFilters,
  buildOverviewRankingRangeFilters,
  buildOverviewSavedDateRangeFilters,
  buildOverviewSingleDayFilters,
  clampOverviewRequestFiltersToSingleDay,
  getOverviewMaxSelectableDateTime,
  normalizeOverviewFilters,
} = overviewFilters;

test("normalizeOverviewFilters converts unix timestamp query params into datetime-local values", () => {
  const filters = normalizeOverviewFilters(
    {
      from: "1774911000",
      until: "1774997399",
    },
    "America/Sao_Paulo",
  );

  assert.equal(filters.from, "2026-03-30T19:50");
  assert.equal(filters.until, "2026-03-31T19:49");
});

test("buildOverviewQueryFromFilters keeps from at minute start and expands until to the end of the minute", () => {
  const query = buildOverviewQueryFromFilters(
    {
      from: "2026-04-28T00:00",
      until: "2026-04-28T23:59",
      domain: "",
      client_ip: "",
      groupBy: "hour",
    },
    "America/Sao_Paulo",
  );

  assert.equal(query.from, 1777345200);
  assert.equal(query.until, 1777431599);
  assert.equal(query.groupBy, "hour");
});

test("default overview filters use closed days in the app timezone", () => {
  const maxSelectable = getOverviewMaxSelectableDateTime("America/Sao_Paulo");
  const defaults = buildDefaultOverviewFilters("America/Sao_Paulo");
  const closedDay = maxSelectable.slice(0, 10);

  assert.equal(defaults.until, maxSelectable);
  assert.equal(defaults.from, `${closedDay}T00:00`);
  assert.equal(defaults.until, `${closedDay}T23:59`);
  assert.equal(defaults.from.slice(0, 10), defaults.until.slice(0, 10));
  assert.equal(defaults.from.slice(11), "00:00");
  assert.equal(defaults.until.slice(11), "23:59");
  assert.equal(defaults.domain, "");
  assert.equal(defaults.client_ip, "");
  assert.equal(defaults.groupBy, "hour");
});

test("normalizeOverviewFilters keeps ranking filters and validates groupBy", () => {
  const filters = normalizeOverviewFilters(
    {
      from: "1774911000",
      until: "1774997399",
      domain: " example.com ",
      client_ip: " 192.168.1.10 ",
      groupBy: "day",
    },
    "America/Sao_Paulo",
  );

  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "day");
});

test("buildOverviewQueryFromFilters serializes ranking filters", () => {
  const query = buildOverviewQueryFromFilters(
    {
      from: "2026-04-28T00:00",
      until: "2026-04-28T23:59",
      domain: " example.com ",
      client_ip: " 192.168.1.10 ",
      groupBy: "day",
    },
    "America/Sao_Paulo",
  );

  assert.equal(query.domain, "example.com");
  assert.equal(query.client_ip, "192.168.1.10");
  assert.equal(query.groupBy, "day");
});

test("normalizeOverviewFilters falls back to hourly grouping", () => {
  const filters = normalizeOverviewFilters({ groupBy: "minute" }, "America/Sao_Paulo");

  assert.equal(filters.groupBy, "hour");
});

test("clampOverviewRequestFiltersToSingleDay keeps manual collection inside the from day", () => {
  const filters = clampOverviewRequestFiltersToSingleDay(
    {
      from: "2026-04-27T08:30",
      until: "2026-04-28T12:45",
      domain: "example.com",
      client_ip: "192.168.1.10",
      groupBy: "day",
    },
    "2026-04-28T23:59",
  );

  assert.equal(filters.from, "2026-04-27T08:30");
  assert.equal(filters.until, "2026-04-27T23:59");
  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "day");
});

test("clampOverviewRequestFiltersToSingleDay clamps future manual collection to the latest closed day", () => {
  const filters = clampOverviewRequestFiltersToSingleDay(
    {
      from: "2026-04-29T08:30",
      until: "2026-04-29T12:45",
      domain: "",
      client_ip: "",
      groupBy: "hour",
    },
    "2026-04-28T23:59",
  );

  assert.equal(filters.from, "2026-04-28T08:30");
  assert.equal(filters.until, "2026-04-28T23:59");
});

test("buildOverviewSingleDayFilters uses one selected date with editable times", () => {
  const filters = buildOverviewSingleDayFilters(
    {
      from: "2026-04-28T00:00",
      until: "2026-04-28T23:59",
      domain: "example.com",
      client_ip: "192.168.1.10",
      groupBy: "day",
    },
    "2026-05-02",
    "09:00",
    "20:59",
    "2026-05-09T23:59",
  );

  assert.equal(filters.from, "2026-05-02T09:00");
  assert.equal(filters.until, "2026-05-02T20:59");
  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "day");
});

test("buildOverviewSingleDayFilters keeps the end time inside the same day and after the start", () => {
  const filters = buildOverviewSingleDayFilters(
    {
      from: "2026-04-28T00:00",
      until: "2026-04-28T23:59",
      domain: "",
      client_ip: "",
      groupBy: "hour",
    },
    "2026-05-10",
    "21:30",
    "07:00",
    "2026-05-09T23:59",
  );

  assert.equal(filters.from, "2026-05-09T21:30");
  assert.equal(filters.until, "2026-05-09T21:30");
});

test("buildOverviewSavedDateRangeFilters allows saved endpoint ranges with missing dates in the middle", () => {
  const filters = buildOverviewSavedDateRangeFilters(
    {
      from: "2026-01-01T00:00",
      until: "2026-01-01T23:59",
      domain: "example.com",
      client_ip: "",
      groupBy: "day",
    },
    "2026-01-01",
    "2026-01-03",
  );

  assert.equal(filters.from, "2026-01-01T00:00");
  assert.equal(filters.until, "2026-01-03T23:59");
  assert.equal(filters.groupBy, "hour");
});

test("buildOverviewSavedDateRangeFilters resets calendar selections to full days", () => {
  const filters = buildOverviewSavedDateRangeFilters(
    {
      from: "2026-01-01T07:00",
      until: "2026-01-01T19:00",
      domain: "example.com",
      client_ip: "192.168.1.10",
      groupBy: "day",
    },
    "2026-05-01",
    "2026-05-04",
  );

  assert.equal(filters.from, "2026-05-01T00:00");
  assert.equal(filters.until, "2026-05-04T23:59");
  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "hour");
});

test("buildOverviewRankingRangeFilters keeps exact date and time boundaries", () => {
  const filters = buildOverviewRankingRangeFilters(
    {
      from: "2026-01-01T00:00",
      until: "2026-01-01T23:59",
      domain: "example.com",
      client_ip: "192.168.1.10",
      groupBy: "day",
    },
    "2026-05-02",
    "08:15",
    "2026-05-02",
    "18:45",
  );

  assert.equal(filters.from, "2026-05-02T08:15");
  assert.equal(filters.until, "2026-05-02T18:45");
  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "hour");
});

test("buildOverviewRankingRangeFilters normalizes inverted intervals", () => {
  const filters = buildOverviewRankingRangeFilters(
    {
      from: "2026-01-01T00:00",
      until: "2026-01-01T23:59",
      domain: "",
      client_ip: "",
      groupBy: "day",
    },
    "2026-05-03",
    "20:00",
    "2026-05-01",
    "07:30",
  );

  assert.equal(filters.from, "2026-05-01T07:30");
  assert.equal(filters.until, "2026-05-03T20:00");
  assert.equal(filters.groupBy, "hour");
});

test("buildOverviewRankingRangeFilters allows multi-day ranges without forcing whole days", () => {
  const filters = buildOverviewRankingRangeFilters(
    {
      from: "2026-01-01T00:00",
      until: "2026-01-01T23:59",
      domain: "",
      client_ip: "",
      groupBy: "hour",
    },
    "2026-05-01",
    "06:10",
    "2026-05-04",
    "22:20",
  );

  assert.equal(filters.from, "2026-05-01T06:10");
  assert.equal(filters.until, "2026-05-04T22:20");
  assert.equal(filters.groupBy, "hour");
});

test("buildOverviewChartBucketTimestamps builds an hourly display range from the selected start to end", () => {
  const buckets = buildOverviewChartBucketTimestamps("2026-05-01T10:00:00.000Z", "2026-05-01T13:59:59.000Z", "hour");

  assert.deepEqual(buckets, [
    "2026-05-01T10:00:00.000Z",
    "2026-05-01T11:00:00.000Z",
    "2026-05-01T12:00:00.000Z",
    "2026-05-01T13:00:00.000Z",
  ]);
});

test("buildOverviewChartBucketTimestamp normalizes chart points to their hourly bucket", () => {
  const bucket = buildOverviewChartBucketTimestamp("2026-05-01T13:45:30.000Z", "hour");

  assert.equal(bucket, "2026-05-01T13:00:00.000Z");
});

test("buildOverviewLocalHourRange returns a sorted full-day range for multi-day full periods", () => {
  const hours = buildOverviewLocalHourRange(
    "2026-05-01T03:00:00.000Z",
    "2026-05-12T02:59:59.000Z",
    "America/Sao_Paulo",
  );

  assert.deepEqual(
    hours,
    Array.from({ length: 24 }, (_, hour) => hour),
  );
});

test("buildOverviewLocalHourRange preserves partial wrapped hour ranges in order", () => {
  const hours = buildOverviewLocalHourRange(
    "2026-05-01T21:00:00.000Z",
    "2026-05-03T10:59:59.000Z",
    "America/Sao_Paulo",
  );

  assert.deepEqual(hours, [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
});

test("buildOverviewHourBucketFilters builds the exact clicked hourly interval", () => {
  const filters = buildOverviewHourBucketFilters(
    {
      from: "2026-05-02T00:00",
      until: "2026-05-02T23:59",
      domain: "example.com",
      client_ip: "192.168.1.10",
      groupBy: "day",
    },
    "2026-05-02T12:00:00.000Z",
    "America/Sao_Paulo",
  );

  assert.ok(filters);
  assert.equal(filters.from, "2026-05-02T09:00");
  assert.equal(filters.until, "2026-05-02T09:59");
  assert.equal(filters.domain, "example.com");
  assert.equal(filters.client_ip, "192.168.1.10");
  assert.equal(filters.groupBy, "hour");
});
