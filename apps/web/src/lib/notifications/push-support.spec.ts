import { getPushSupportStatus } from "./push-support";
import assert from "node:assert/strict";
import test from "node:test";

test("supports push in secure contexts with browser APIs and server configuration", () => {
  assert.equal(
    getPushSupportStatus({
      windowObject: {
        isSecureContext: true,
        Notification: {},
        PushManager: {},
      },
      navigatorObject: {
        serviceWorker: {},
      },
      serverAvailable: true,
    }),
    "supported",
  );
});

test("reports insecure context before browser API support", () => {
  assert.equal(
    getPushSupportStatus({
      windowObject: {
        isSecureContext: false,
      },
      navigatorObject: {},
      serverAvailable: true,
    }),
    "insecure-context",
  );
});

test("reports unsupported browser when push APIs are missing in a secure context", () => {
  assert.equal(
    getPushSupportStatus({
      windowObject: {
        isSecureContext: true,
        Notification: {},
      },
      navigatorObject: {},
      serverAvailable: true,
    }),
    "unsupported-browser",
  );
});

test("reports unavailable server configuration when browser support is present", () => {
  assert.equal(
    getPushSupportStatus({
      windowObject: {
        isSecureContext: true,
        Notification: {},
        PushManager: {},
      },
      navigatorObject: {
        serviceWorker: {},
      },
      serverAvailable: false,
    }),
    "server-unavailable",
  );
});
