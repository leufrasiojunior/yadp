import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildBaseUrl, normalizeHostPath, normalizeSetupHostInput } = require("./setup-form.helpers.ts") as {
  buildBaseUrl: (scheme: "http" | "https", hostPath: string | null | undefined) => string;
  normalizeHostPath: (value: string | null | undefined) => string;
  normalizeSetupHostInput: (value: string | null | undefined) => null | {
    scheme?: "http" | "https";
    hostPath: string;
  };
};

test("normalizes a pasted https Pi-hole URL into scheme and host", () => {
  assert.deepEqual(normalizeSetupHostInput("https://192.168.31.17:444/admin/queries"), {
    scheme: "https",
    hostPath: "192.168.31.17:444",
  });
});

test("normalizes a pasted http Pi-hole URL into scheme and host", () => {
  assert.deepEqual(normalizeSetupHostInput("http://pi.hole/admin"), {
    scheme: "http",
    hostPath: "pi.hole",
  });
});

test("keeps host and port without changing the selected scheme", () => {
  assert.deepEqual(normalizeSetupHostInput("192.168.31.17:444"), {
    hostPath: "192.168.31.17:444",
  });
});

test("builds the final setup base URL from normalized pasted input", () => {
  const normalized = normalizeSetupHostInput("https://192.168.31.17:444/admin/queries");

  assert.equal(buildBaseUrl(normalized?.scheme ?? "http", normalized?.hostPath), "https://192.168.31.17:444");
});

test("rejects URLs with embedded credentials", () => {
  assert.equal(normalizeSetupHostInput("https://admin:secret@pi.hole/admin"), null);
});

test("normalizes host paths without protocol by removing the pasted path", () => {
  assert.equal(normalizeHostPath("pi.hole/admin"), "pi.hole");
});
