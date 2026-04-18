import type { DomainItem } from "./domains.types";
import {
  DOMAINS_CSV_HEADERS,
  parseDomainEnabledValue,
  parseDomainGroupCell,
  parseDomainsCsv,
  serializeDomainsCsv,
} from "./domains-csv";
import assert from "node:assert/strict";
import test from "node:test";

test("serializeDomainsCsv preserves header order and escapes values", () => {
  const items: DomainItem[] = [
    {
      domain: "example.com",
      unicode: null,
      type: "allow",
      kind: "exact",
      comment: 'Needs "quotes"',
      enabled: true,
      groups: [0, 2],
      id: 1,
      dateAdded: null,
      dateModified: null,
      origin: {
        instanceId: "baseline",
        instanceName: "Baseline",
      },
      sync: {
        isFullySynced: true,
        sourceInstances: [],
        missingInstances: [],
      },
    },
  ];

  const csv = serializeDomainsCsv(items, () => ["Default", "Kids"]);
  const [header, row] = csv.trim().split("\n");

  assert.equal(header?.replace(/\r$/, ""), DOMAINS_CSV_HEADERS.join(","));
  assert.match(row ?? "", /"Needs ""quotes"""/);
  assert.match(row ?? "", /Default\|Kids/);
});

test("parseDomainsCsv reads exported rows back", () => {
  const csv = [
    DOMAINS_CSV_HEADERS.join(","),
    'example.com,allow,exact,enabled,"Comment, with comma",Default|Kids',
  ].join("\r\n");

  const rows = parseDomainsCsv(csv);

  assert.deepEqual(rows, [
    {
      line: 2,
      domain: "example.com",
      type: "allow",
      kind: "exact",
      enabled: "enabled",
      comment: "Comment, with comma",
      group: "Default|Kids",
    },
  ]);
});

test("parseDomainEnabledValue accepts stable import values", () => {
  assert.equal(parseDomainEnabledValue("enabled"), true);
  assert.equal(parseDomainEnabledValue("disabled"), false);
  assert.equal(parseDomainEnabledValue("true"), true);
  assert.equal(parseDomainEnabledValue("0"), false);
  assert.equal(parseDomainEnabledValue("maybe"), null);
});

test("parseDomainGroupCell splits pipe-separated groups", () => {
  assert.deepEqual(parseDomainGroupCell("Default|Kids| Guests "), ["Default", "Kids", "Guests"]);
});
