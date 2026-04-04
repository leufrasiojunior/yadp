import { cookies, headers } from "next/headers";

import { getSetupStatus, isYapdApiResponseError, isYapdApiUnavailableError } from "../api/yapd-server";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, LOCALE_COOKIE_KEY, normalizeAppLocale, normalizeTimeZone } from "./config";
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

export async function getServerTimeZone() {
  try {
    const setup = await getSetupStatus();
    return normalizeTimeZone(setup.timeZone, DEFAULT_TIME_ZONE);
  } catch (error) {
    if (isYapdApiUnavailableError(error) || isYapdApiResponseError(error)) {
      return DEFAULT_TIME_ZONE;
    }

    throw error;
  }
}

export async function getServerI18n() {
  const locale = await getServerLocale();

  return {
    locale,
    messages: getWebMessages(locale),
  };
}
