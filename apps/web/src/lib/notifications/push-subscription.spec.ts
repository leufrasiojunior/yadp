import { decodePushPublicKey, isCurrentPushSubscriptionServerKey } from "./push-subscription";
import assert from "node:assert/strict";
import test from "node:test";

function encodeBase64Url(bytes: number[]) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

test("recognizes matching application server key", () => {
  const publicKey = encodeBase64Url([1, 2, 3, 4, 5, 6, 7, 8]);
  const decoded = decodePushPublicKey(publicKey);

  assert.equal(isCurrentPushSubscriptionServerKey(decoded.buffer, publicKey), true);
});

test("detects outdated application server key", () => {
  const currentPublicKey = encodeBase64Url([1, 2, 3, 4, 5, 6, 7, 8]);
  const oldPublicKey = encodeBase64Url([8, 7, 6, 5, 4, 3, 2, 1]);
  const decodedOld = decodePushPublicKey(oldPublicKey);

  assert.equal(isCurrentPushSubscriptionServerKey(decodedOld.buffer, currentPublicKey), false);
});

test("treats missing application server key as outdated", () => {
  assert.equal(isCurrentPushSubscriptionServerKey(null, encodeBase64Url([1, 2, 3, 4, 5, 6, 7, 8])), false);
});
