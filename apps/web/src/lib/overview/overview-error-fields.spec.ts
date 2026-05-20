import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { getAutomaticImportApiFieldErrors } = require("./overview-error-fields.ts") as {
  getAutomaticImportApiFieldErrors: (message: string) => Record<string, string>;
};

test("maps invalid automatic import cron payload to the cron field", () => {
  const message = "Invalid cron expression: expected 5 fields";

  assert.deepEqual(getAutomaticImportApiFieldErrors(message), {
    cronExpression: message,
  });
});

test("maps automatic import instance scope payload to the target field", () => {
  const message = '"instanceId" is required when scope="instance".';

  assert.deepEqual(getAutomaticImportApiFieldErrors(message), {
    target: message,
  });
});
