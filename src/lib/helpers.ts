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

// ---------- helpers ----------

/** Percentual com arredondamento sempre para cima (ceil). */
export function formatPercentCeil(
  numerator: number,
  denominator: number,
  localeStr: string,
  digits: number = 2,
): string {
  if (!denominator || denominator <= 0)
    return (
      new Intl.NumberFormat(localeStr, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(0) + "%"
    );
  const raw = (numerator / denominator) * 100;
  const factor = Math.pow(10, digits);
  const ceiled = Math.ceil(raw * factor) / factor; // sempre para cima
  return (
    new Intl.NumberFormat(localeStr, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(ceiled) + "%"
  );
}
