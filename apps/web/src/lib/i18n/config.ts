export const APP_LOCALES = ["pt-BR", "en-US"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";
export const LOCALE_COOKIE_KEY = "language";

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

export function formatLocaleDateTime(locale: AppLocale, value: string | Date) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}
