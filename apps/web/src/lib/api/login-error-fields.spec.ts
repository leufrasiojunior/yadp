import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isCredentialPasswordError } = require("./login-error-fields.ts") as {
  isCredentialPasswordError: (message: string) => boolean;
};

test("marks rejected YAPD password payloads as password field errors", () => {
  assert.equal(isCredentialPasswordError("The YAPD password is invalid."), true);
});

test("keeps unreachable instance payloads as general login feedback", () => {
  assert.equal(isCredentialPasswordError("Could not reach https://pihole.local."), false);
});
