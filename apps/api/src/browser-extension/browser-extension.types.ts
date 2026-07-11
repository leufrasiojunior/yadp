import { createHash, timingSafeEqual } from "node:crypto";

export const BROWSER_EXTENSION_SETTINGS_ID = "singleton";
export const BROWSER_EXTENSION_PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const BROWSER_EXTENSION_COMMENT_PREFIX = "Added from YAPD Inspector";

export const BROWSER_EXTENSION_KIND_VALUES = ["exact", "regex"] as const;
export const BROWSER_EXTENSION_RISK_LEVEL_VALUES = ["low", "medium", "high"] as const;
export const BROWSER_EXTENSION_PATTERN_MODE_VALUES = ["exact", "regex_specific", "regex_any"] as const;
export const BROWSER_EXTENSION_BATCH_STATUS_VALUES = ["detected", "applied", "partial", "failed", "undone"] as const;
export const BROWSER_EXTENSION_ITEM_STATUS_VALUES = [
  "detected",
  "blocked",
  "allowed",
  "applied",
  "skipped",
  "failed",
  "undone",
] as const;
export const BROWSER_EXTENSION_DECISION_VALUES = ["allow", "deny", "ignore"] as const;
export const BROWSER_EXTENSION_DEFAULT_PAGE_SIZE = 10;
export const BROWSER_EXTENSION_MAX_PAGE_SIZE = 100;

export type BrowserExtensionKind = (typeof BROWSER_EXTENSION_KIND_VALUES)[number];
export type BrowserExtensionRiskLevel = (typeof BROWSER_EXTENSION_RISK_LEVEL_VALUES)[number];
export type BrowserExtensionPatternMode = (typeof BROWSER_EXTENSION_PATTERN_MODE_VALUES)[number];
export type BrowserExtensionBatchStatus = (typeof BROWSER_EXTENSION_BATCH_STATUS_VALUES)[number];
export type BrowserExtensionItemStatus = (typeof BROWSER_EXTENSION_ITEM_STATUS_VALUES)[number];
export type BrowserExtensionDecision = (typeof BROWSER_EXTENSION_DECISION_VALUES)[number];

export type BrowserExtensionAuthContext = {
  id: string;
  name: string;
  browser: string;
  manifestVersion: number;
  extensionVersion: string;
  tokenPrefix: string;
};

export type BrowserExtensionSettingsPayload = {
  sendPageTitle: boolean;
  hardBlockedUrlPatterns: string[];
  sensitiveUrlPatterns: string[];
};

export type BrowserExtensionRuleCacheItem = {
  target: string;
  kind: BrowserExtensionKind;
  source: "browser_extension_decision" | "managed_domain";
};

export type BrowserExtensionConfigResponse = {
  settings: BrowserExtensionSettingsPayload;
  allowlist: BrowserExtensionRuleCacheItem[];
  blockedItems: BrowserExtensionRuleCacheItem[];
};

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
