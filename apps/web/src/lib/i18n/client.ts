"use client";

import { formatFullDateTime, formatLocaleDateTime } from "@/lib/i18n/config";
import { getWebMessages } from "@/lib/i18n/messages";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export function useAppLocale() {
  return usePreferencesStore((state) => state.language);
}

export function useWebI18n() {
  const locale = useAppLocale();
  const timeZone = usePreferencesStore((state) => state.timeZone);

  return {
    locale,
    timeZone,
    messages: getWebMessages(locale),
    formatDateTime(value: string | Date) {
      return formatLocaleDateTime(locale, value, timeZone);
    },
    formatFullDateTime(value: string | Date) {
      return formatFullDateTime(value, timeZone);
    },
  };
}
