import type { Locale as DateFnsLocale } from "date-fns";
import { ptBR } from "date-fns/locale";

import { formatUnixTime } from "@/lib/utils";

export function mapToDateFnsLocale(l: string): DateFnsLocale | undefined {
  if (l?.toLowerCase().startsWith("pt")) return ptBR;
  return undefined;
}

export function isMs(ts: number) {
  return ts >= 1e12;
}

export function toMs(ts: number) {
  return isMs(ts) ? ts : ts * 1000;
}

export function floorToHourSameUnit(ts: number) {
  return isMs(ts) ? Math.floor(ts / 3_600_000) * 3_600_000 : Math.floor(ts / 3_600) * 3_600;
}

export function safeFormatUnixTime(
  ts: number | string | undefined,
  pattern: string,
  dfnsLocale?: DateFnsLocale,
  forceHourClosed?: boolean, // Nova opção
): string {
  if (ts === undefined || ts === null || ts === "") return "";

  try {
    let timestamp = Number(ts);

    // Se forceHourClosed = true, arredonda para hora fechada
    if (forceHourClosed) {
      const date = new Date(timestamp);
      date.setMinutes(0, 0, 0);
      timestamp = date.getTime();
    }

    return dfnsLocale ? formatUnixTime(timestamp, pattern, dfnsLocale) : formatUnixTime(timestamp, pattern);
  } catch {
    return "";
  }
}
