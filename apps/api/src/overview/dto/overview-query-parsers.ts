export function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

export function parseOptionalNumber(value: unknown) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function trimOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
