export const DEFAULT_API_TIME_ZONE = "UTC";

function canonicalizeApiTimeZone(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: trimmed,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function isValidApiTimeZone(value: string | null | undefined) {
  return canonicalizeApiTimeZone(value) !== null;
}

export function normalizeApiTimeZone(value: string | null | undefined, fallback: string = DEFAULT_API_TIME_ZONE) {
  return canonicalizeApiTimeZone(value) ?? fallback;
}
