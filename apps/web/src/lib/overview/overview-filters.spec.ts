import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const overviewFilters = require("./overview-filters.ts") as {
  buildDefaultOverviewFilters: (timeZone: string) => {
    from: string;
    until: string;
    domain: string;
    client_ip: string;
    groupBy: "hour" | "day";
  };
  buildOverviewQueryFromFilters: (
    filters: { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" },
    timeZone: string,
  ) => { from?: number; until?: number; domain?: string; client_ip?: string; groupBy: "hour" | "day" };
  getOverviewMaxSelectableDateTime: (timeZone: string) => string;
  normalizeOverviewFilters: (
    searchParams: Record<string, string | string[] | undefined>,
    timeZone: string,
  ) => { from: string; until: string; domain: string; client_ip: string; groupBy: "hour" | "day" };
};
const {
  buildDefaultOverviewFilters,
  buildOverviewQueryFromFilters,
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

  assert.equal(defaults.until, maxSelectable);
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
