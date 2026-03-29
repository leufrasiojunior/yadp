import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, normalizeAppLocale } from "./config";
import { getWebMessages } from "./messages";

export async function getServerLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;

  if (cookieLocale) {
    return normalizeAppLocale(cookieLocale);
  }

  const requestHeaders = await headers();

  return normalizeAppLocale(requestHeaders.get("accept-language"), DEFAULT_LOCALE);
}

export async function getServerI18n() {
  const locale = await getServerLocale();

  return {
    locale,
    messages: getWebMessages(locale),
  };
}
