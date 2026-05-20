import { normalizeManagedInstanceBaseUrl, normalizeManagedInstanceOriginUrl } from "./managed-instance-base-url";
import assert from "node:assert/strict";
import test from "node:test";

test("normalizes setup origin URLs without persisting pasted paths", () => {
  assert.equal(
    normalizeManagedInstanceOriginUrl("https://192.168.31.17:444/admin/queries"),
    "https://192.168.31.17:444",
  );
});

test("rejects base URLs with query strings", () => {
  assert.throws(() => normalizeManagedInstanceBaseUrl("https://pi.hole/admin?tab=queries"));
});

test("rejects base URLs with hashes", () => {
  assert.throws(() => normalizeManagedInstanceBaseUrl("https://pi.hole/admin#queries"));
});
