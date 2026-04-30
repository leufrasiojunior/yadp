import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const overviewFilters = require("./overview-filters.ts") as {
  buildDefaultOverviewFilters: (timeZone: string) => { from: string; until: string };
  buildOverviewQueryFromFilters: (
    filters: { from: string; until: string },
    timeZone: string,
  ) => { from?: number; until?: number };
  getOverviewMaxSelectableDateTime: (timeZone: string) => string;
  normalizeOverviewFilters: (
    searchParams: Record<string, string | string[] | undefined>,
    timeZone: string,
  ) => { from: string; until: string };
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
    },
    "America/Sao_Paulo",
  );

  assert.equal(query.from, 1777345200);
  assert.equal(query.until, 1777431599);
});

test("default overview filters use closed days in the app timezone", () => {
  const maxSelectable = getOverviewMaxSelectableDateTime("America/Sao_Paulo");
  const defaults = buildDefaultOverviewFilters("America/Sao_Paulo");

  assert.equal(defaults.until, maxSelectable);
  assert.equal(defaults.from.slice(11), "00:00");
  assert.equal(defaults.until.slice(11), "23:59");
});
