import { clsx, type ClassValue } from "clsx";
import { format as formatDateFn, Locale } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getInitials = (str: string): string => {
  if (typeof str !== "string" || !str.trim()) return "?";

  return (
    str
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
};

export function formatCurrency(
  amount: number,
  opts?: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    noDecimals?: boolean;
  },
) {
  const { currency = "USD", locale = "en-US", minimumFractionDigits, maximumFractionDigits, noDecimals } = opts ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : minimumFractionDigits,
    maximumFractionDigits: noDecimals ? 0 : maximumFractionDigits,
  };

  return new Intl.NumberFormat(locale, formatOptions).format(amount);
}

/**
 * Formata um Unix timestamp (em segundos ou milissegundos) para data/hora segundo o padrão fornecido.
 * Suporta timestamp em string ou número e detecta automaticamente se está em segundos ou ms.
 * Permite passar um locale do date-fns para formatações com nomes de mês/dia localizados.
 *
 * @param ts - Timestamp Unix (segundos ou ms), como número ou string
 * @param pattern - Padrão de formatação (date-fns), ex: "dd/MM/yyyy", "HH:mm:ss", "yyyy-MM-dd HH:mm", "MMMM d, yyyy"
 * @param locale - (Opcional) locale do date-fns para nomes de mês/dia localizados
 * @returns String formatada conforme o pattern e locale
 */
export function formatUnixTime(ts: number | string, pattern: string = "yyyy-MM-dd HH:mm:ss", locale?: Locale): string {
  // Garante que ts seja número
  const value = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (isNaN(value)) {
    throw new Error(`Invalid Unix timestamp: ${ts}`);
  }

  // Converte de segundos para ms, se necessário (<= 10 dígitos implica segundos)
  const timestampMs = value.toString().length <= 10 ? value * 1000 : value;

  const date = new Date(timestampMs);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid time value for timestamp: ${ts}`);
  }

  // Se locale fornecido, passa pelos options; caso contrário, formata somente com o pattern
  return locale ? formatDateFn(date, pattern, { locale }) : formatDateFn(date, pattern);
}
