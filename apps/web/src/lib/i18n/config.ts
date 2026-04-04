export const APP_LOCALES = ["pt-BR", "en-US"] as const;
export const DEFAULT_TIME_ZONE = "UTC";

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";
export const LOCALE_COOKIE_KEY = "language";

const SUPPORTED_TIME_ZONES =
  typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export const TIME_ZONE_OPTIONS = Array.from(new Set([DEFAULT_TIME_ZONE, ...SUPPORTED_TIME_ZONES]));

export const LOCALE_OPTIONS: ReadonlyArray<{
  value: AppLocale;
  label: string;
  shortLabel: string;
}> = [
  {
    value: "pt-BR",
    label: "Português (Brasil)",
    shortLabel: "PT-BR",
  },
  {
    value: "en-US",
    label: "English (US)",
    shortLabel: "EN-US",
  },
];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "pt-BR" || value === "en-US";
}

export function normalizeAppLocale(value: string | null | undefined, fallback: AppLocale = DEFAULT_LOCALE): AppLocale {
  if (!value) {
    return fallback;
  }

  if (isAppLocale(value)) {
    return value;
  }

  const lower = value.toLowerCase();

  if (lower.startsWith("pt")) {
    return "pt-BR";
  }

  if (lower.startsWith("en")) {
    return "en-US";
  }

  return fallback;
}

export function applyLocaleToDocument(locale: AppLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.setAttribute("data-language", locale);
}

export function getRuntimeLocale(): AppLocale {
  if (typeof document !== "undefined") {
    return normalizeAppLocale(
      document.documentElement.getAttribute("data-language") ?? document.documentElement.lang ?? navigator.language,
    );
  }

  return DEFAULT_LOCALE;
}

function canonicalizeTimeZone(value: string | null | undefined) {
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

export function isValidTimeZone(value: string | null | undefined) {
  return canonicalizeTimeZone(value) !== null;
}

export function normalizeTimeZone(value: string | null | undefined, fallback: string = DEFAULT_TIME_ZONE) {
  return canonicalizeTimeZone(value) ?? fallback;
}

export function getConfiguredTimeZone() {
  return DEFAULT_TIME_ZONE;
}

export function applyTimeZoneToDocument(timeZone: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-timezone", normalizeTimeZone(timeZone));
}

export function getRuntimeTimeZone() {
  if (typeof document !== "undefined") {
    return normalizeTimeZone(document.documentElement.getAttribute("data-timezone"), DEFAULT_TIME_ZONE);
  }

  return getConfiguredTimeZone();
}

export function formatLocaleDateTime(locale: AppLocale, value: string | Date, timeZone: string = getRuntimeTimeZone()) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Formats a date in a technical, ISO-like format (YYYY-MM-DD HH:mm:ss)
 * but respecting the provided or runtime timezone.
 */
export function formatFullDateTime(value: string | Date, timeZone: string = getRuntimeTimeZone()) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}
