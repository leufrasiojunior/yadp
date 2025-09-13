"use client";

import { useMemo } from "react";

import { Joti_One } from "next/font/google";

import type { Locale as DateFnsLocale } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregatedPiholeQuery } from "@/hooks/use-aggregated-pihole-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { mapToDateFnsLocale, safeFormatUnixTime } from "@/lib/helpers";
import { ClientHistoryResponse } from "@/types/pihole";

// Type for aggregated data for the chart
export type AggregatedClientHistoryEntry = {
  date: number; // timestamp in ms
  [client: string]: number;
};
export type AggregatedClientHistory = AggregatedClientHistoryEntry[];

const initialData: AggregatedClientHistory = [];

// Aggregator function to process API data
const historyAggregator = (results: ClientHistoryResponse[]): AggregatedClientHistory => {
  const aggregated: Record<number, Record<string, number>> = {};

  for (const result of results) {
    if (!result.history) continue;
    for (const item of result.history) {
      const timestamp = item.timestamp * 1000; // to ms
      if (!aggregated[timestamp]) {
        aggregated[timestamp] = {};
      }
      for (const [client, count] of Object.entries(item.data)) {
        if (!aggregated[timestamp][client]) {
          aggregated[timestamp][client] = 0;
        }
        aggregated[timestamp][client] += count;
      }
    }
  }

  return Object.entries(aggregated)
    .map(([timestamp, values]) => ({
      date: Number(timestamp),
      ...values,
    }))
    .sort((a, b) => a.date - b.date);
};

export function ChartClientArea() {
  const t = useTranslations("dashboard.clientActivity");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const dfnsLocale: DateFnsLocale | undefined = mapToDateFnsLocale(locale);

  const piholeEndpoint = `history/clients`;

  const { data: history, loading } = useAggregatedPiholeQuery<ClientHistoryResponse, AggregatedClientHistory>(
    piholeEndpoint,
    historyAggregator,
    initialData,
  );

  const { chartData, chartConfig, allClients } = useMemo(() => {
    if (!history) return { chartData: [], chartConfig: {}, allClients: [] };

    // 1. Calcular totais
    const clientTotals: Record<string, number> = {};
    for (const item of history) {
      Object.entries(item).forEach(([key, value]) => {
        if (key !== "date") {
          clientTotals[key] = (clientTotals[key] || 0) + value;
        }
      });
    }

    // 2. Ordenar
    const sortedClients = Object.entries(clientTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([client]) => client);

    const topClients = sortedClients.slice(0, 5);
    const otherClients = sortedClients.slice(5);

    // 3. Transformar chartData para incluir "Outros"
    const dataWithOthers = history.map((item) => {
      const newItem: any = { date: item.date };
      let othersSum = 0;

      for (const [key, value] of Object.entries(item)) {
        if (key === "date") continue;
        if (topClients.includes(key)) {
          newItem[key] = value;
        } else {
          othersSum += value;
        }
      }

      newItem["Outros"] = othersSum;
      return newItem;
    });

    const fixedColors = ["var(--chart-1)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)", "var(--chart-9)"];

    // 4. Config de cores
    const config: ChartConfig = {};
    [...topClients, "Outros"].forEach((client, index) => {
      config[client] = {
        label: client,
        color: fixedColors[index] ?? fixedColors[fixedColors.length - 1],
      };
    });

    return { chartData: dataWithOthers, chartConfig: config, allClients: [...topClients, "Outros"] };
  }, [history]);

  const tickFormatter = (value: number) => {
    return safeFormatUnixTime(value, "HH:mm", dfnsLocale, true);
  };

  if (loading) {
    return (
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={tickFormatter}
              tickCount={8}
              minTickGap={30}
            />
            <YAxis tickLine axisLine />
            <ChartTooltip
              cursor
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;

                // Ordena pelo valor (maior → menor)
                const sortedPayload = [...payload].sort((a, b) => (b.value as number) - (a.value as number));

                const total = sortedPayload.reduce((sum, p) => sum + (p.value as number), 0);

                return (
                  <div className="bg-background rounded-lg border p-2 shadow">
                    <div className="mb-1 font-medium">
                      {safeFormatUnixTime(label, "d MMM, HH:mm", dfnsLocale, true)}
                    </div>
                    {sortedPayload.map((p) => {
                      const value = p.value as number;
                      const percent = total > 0 ? ((value / total) * 100).toFixed(2) : "0.00";
                      return (
                        <div key={p.dataKey} className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: p.color }} />
                          <span>
                            {p.dataKey}: {value} ({percent}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />

            {allClients.map((client) => (
              <Bar
                key={client}
                dataKey={client}
                type="natural"
                fill={chartConfig[client]?.color}
                fillOpacity={0.4}
                stroke={chartConfig[client]?.color}
                stackId="a"
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
