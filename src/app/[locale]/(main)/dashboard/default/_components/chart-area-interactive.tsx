"use client";

import { useMemo } from "react";

import { getUnixTime, subHours, Locale as DateFnsLocale } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregatedPiholeQuery } from "@/hooks/use-aggregated-pihole-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPercentCeil, mapToDateFnsLocale, safeFormatUnixTime } from "@/lib/helpers";
import { ChartHistoryType, FullHistoryType, PayloadChart } from "@/types/pihole";

// Logic from usePiholeHistory hook
type AggregatedHistory = {
  date: number;
  total: number;
  cached: number;
  blocked: number;
}[];

const initialData: AggregatedHistory = [];

const historyAggregator = (results: { url: string; data: FullHistoryType }[]): AggregatedHistory => {
  const aggregated: Record<number, { total: number; cached: number; blocked: number }> = {};

  for (const { data: historyData } of results) {
    // ← pega só o `data`
    for (const item of historyData.history) {
      if (!aggregated[item.timestamp]) {
        aggregated[item.timestamp] = { total: 0, cached: 0, blocked: 0 };
      }
      aggregated[item.timestamp].total += item.total;
      aggregated[item.timestamp].cached += item.cached;
      aggregated[item.timestamp].blocked += item.blocked;
    }
  }

  return Object.entries(aggregated)
    .map(([timestamp, values]) => ({
      date: Number(timestamp) * 1000,
      total: values.total,
      cached: values.cached,
      blocked: values.blocked,
    }))
    .sort((a, b) => a.date - b.date);
};

// End of logic from usePiholeHistory hook

export function ChartAreaInteractive() {
  const t = useTranslations("dashboard.historyChart");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const dfnsLocale: DateFnsLocale | undefined = mapToDateFnsLocale(locale);

  const tickFormatter = (value: number) => {
    return safeFormatUnixTime(value, "HH:mm", dfnsLocale, true);
  };

  // Inlined hook logic
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);
  const from = getUnixTime(twentyFourHoursAgo);
  const until = getUnixTime(now);
  const piholeEndpoint = `history/database?from=${from}&until=${until}`;

  const { data: history, loading } = useAggregatedPiholeQuery<FullHistoryType, AggregatedHistory>(
    piholeEndpoint,
    historyAggregator,
    initialData,
    // 2000,
  );
  // End of inlined hook logic

  const chartConfig = {
    blocked: {
      label: t("tooltip_blocked"),
      color: "var(--chart-3)",
    },
    total: {
      label: t("tooltip_total"),
      color: "var(--chart-4)",
    },
  } satisfies ChartConfig;

  const processedData = useMemo(() => {
    if (!history?.length) {
      return {
        data: [],
        tickFormatter: (value: number) => safeFormatUnixTime(value, "HH:mm", dfnsLocale),
        hasValidData: false,
      };
    }

    // Processa os dados garantindo timestamps válidos
    const validData = history
      .map((item: ChartHistoryType) => {
        const timestamp = Number(item.date);
        if (isNaN(timestamp)) return null;

        return {
          ...item,
          date: timestamp, // Mantém o timestamp original
        };
      })
      .filter((item) => item !== null);
    // Função para formatar os ticks
    const tickFormatter = (value: number) => {
      return safeFormatUnixTime(value, "HH:mm", dfnsLocale, true);
    };

    return {
      data: validData,
      tickFormatter,
      hasValidData: validData.length > 0,
    };
  }, [history, dfnsLocale]);

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
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} />

            {/* Eixo X: últimas 24h → hora:minuto */}
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={processedData.tickFormatter}
              tickCount={8}
              minTickGap={30}
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
                const rawTs = point?.date ?? point?.timestamp; // ← fix: não usar apenas timestamp

                const total: number = Number(point?.total ?? 0);
                const blocked: number = Number(point?.blocked ?? 0);

                const tsLabel = safeFormatUnixTime(rawTs, "d MMM, HH:mm", dfnsLocale);
                const pctBlockedLabel = formatPercentCeil(blocked, total, locale, 2);

                // Nome das séries com i18n
                const items = payload.map((entry: PayloadChart) => {
                  const key = String(entry.dataKey);
                  const name = (chartConfig as ChartConfig)[key]?.label ?? key;
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
