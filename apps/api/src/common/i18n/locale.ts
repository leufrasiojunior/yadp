import type { Request } from "express";

export const API_LOCALES = ["pt-BR", "en-US"] as const;

export type ApiLocale = (typeof API_LOCALES)[number];

export const DEFAULT_API_LOCALE: ApiLocale = "pt-BR";
export const API_LOCALE_COOKIE = "language";

export function normalizeApiLocale(
  value: string | null | undefined,
  fallback: ApiLocale = DEFAULT_API_LOCALE,
): ApiLocale {
  if (!value) {
    return fallback;
  }

  if (value === "pt-BR" || value === "en-US") {
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

export function getRequestLocale(request?: Request) {
  if (!request) {
    return DEFAULT_API_LOCALE;
  }

  const cookieLocale = request.cookies?.[API_LOCALE_COOKIE];

  if (typeof cookieLocale === "string") {
    return normalizeApiLocale(cookieLocale);
  }

  const acceptLanguage = request.headers["accept-language"];

  if (typeof acceptLanguage === "string") {
    return normalizeApiLocale(acceptLanguage);
  }

  if (Array.isArray(acceptLanguage)) {
    return normalizeApiLocale(acceptLanguage[0]);
  }

  return DEFAULT_API_LOCALE;
}
