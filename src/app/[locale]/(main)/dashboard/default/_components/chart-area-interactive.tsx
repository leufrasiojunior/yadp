"use client";

import type { Locale as DateFnsLocale } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePiholeHistory } from "@/hooks/use-pihole-history";
import { formatUnixTime } from "@/lib/utils";
import { ChartHistoryType, PayloadChart } from "@/types/pihole";

export const description = "An interactive area chart";

export function ChartAreaInteractive() {
  const t = useTranslations("dashboard.historyChart");
  const locale = useLocale(); // e.g. "pt-BR"
  const { history, loading } = usePiholeHistory();
  const isMobile = useIsMobile();

  // Map next-intl locale -> date-fns locale
  const dfnsLocale: DateFnsLocale | undefined = mapToDateFnsLocale(locale);

  const chartConfig = {
    blocked: {
      label: t("tooltip_blocked"),
      color: "var(--chart-5)",
    },
    total: {
      label: t("tooltip_total"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <Skeleton className="h-7 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <Skeleton className="aspect-auto h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{t("description")}</span>
          <span className="@[540px]/card:hidden">{t("description_mobile")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="fillBlocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} />

            {/* Eixo X: últimas 24h → hora:minuto */}
            <XAxis
              dataKey="date" // IMPORTANTE: seu payload usa "date" (ms). Se usar "timestamp" (s), ajuste aqui.
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string | number) => safeFormatUnixTime(value, "HH:mm", dfnsLocale)}
            />

            <YAxis tickLine axisLine />

            {/* Tooltip custom: inclui % blocked sem alterar o payload do gráfico */}
            <ChartTooltip
              cursor
              defaultIndex={isMobile ? -1 : 10}
              content={({ payload }) => {
                if (!payload?.length) return null;

                // OBS: no seu log o campo de tempo é "date" (ms). Mantemos compatível com "timestamp" (s) também.
                const point = payload[0].payload as ChartHistoryType;
                console.log("point", point);
                const rawTs = point?.date ?? point?.timestamp; // ← fix: não usar apenas timestamp

                const total: number = Number(point?.total ?? 0);
                const blocked: number = Number(point?.blocked ?? 0);

                const tsLabel = safeFormatUnixTime(rawTs, "d MMM, HH:mm", dfnsLocale);
                const pctBlockedLabel = formatPercentCeil(blocked, total, locale, 2);

                // Nome das séries com i18n
                const items = payload.map((entry: PayloadChart) => {
                  console.log("entry", entry);
                  const key = String(entry.dataKey);
                  const name = (chartConfig as any)[key]?.label ?? key;
                  return {
                    key,
                    name,
                    color: entry.color,
                    value: entry.value,
                  };
                });

                return (
                  <div className="bg-background/95 rounded-xl border p-3 shadow-md backdrop-blur">
                    <div className="text-muted-foreground mb-1 text-xs font-medium">{tsLabel}</div>

                    <div className="flex flex-col gap-0.5">
                      {items.map((it) => (
                        <div key={it.key} className="flex items-center gap-2 text-sm">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color }} />
                          <span className="text-muted-foreground">{it.name}:</span>
                          <span className="font-medium">{it.value}</span>
                        </div>
                      ))}

                      {/* Linha extra: % blocked */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-5)]" />
                        <span className="text-muted-foreground">{t("tooltip_blockedPercent")}</span>
                        <span className="font-medium">{pctBlockedLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            <Area dataKey="total" type="natural" fill="url(#fillTotal)" stroke="var(--chart-1)" stackId="a" />
            <Area dataKey="blocked" type="natural" fill="url(#fillBlocked)" stroke="var(--chart-5)" stackId="b" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------- helpers ----------

/** Mapeia locale string (next-intl) para objeto locale do date-fns. */
function mapToDateFnsLocale(l: string): DateFnsLocale | undefined {
  // Por enquanto atendemos pt e pt-BR. Expanda conforme necessário.
  if (l?.toLowerCase().startsWith("pt")) return ptBR;
  return undefined; // fallback: sem locale → usa default do date-fns
}

/**
 * Usa formatUnixTime com proteção contra valores indefinidos/ruins.
 * Evita lançar erros no tooltip; retorna string vazia em casos inválidos.
 */
function safeFormatUnixTime(ts: number | string | undefined, pattern: string, dfnsLocale?: DateFnsLocale): string {
  if (ts === undefined || ts === null || ts === "") return ""; // evita exception
  try {
    return dfnsLocale ? formatUnixTime(ts, pattern, dfnsLocale) : formatUnixTime(ts, pattern);
  } catch {
    return ""; // por quê: não queremos quebrar o tooltip
  }
}

/** Percentual com arredondamento sempre para cima (ceil). */
function formatPercentCeil(numerator: number, denominator: number, localeStr: string, digits: number = 2): string {
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
