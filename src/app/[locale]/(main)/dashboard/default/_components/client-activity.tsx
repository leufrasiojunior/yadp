"use client";

import { useMemo } from "react";

import type { Locale as DateFnsLocale } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

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
    const clientSet = new Set<string>();
    if (history) {
      // Get top 5 clients based on total queries
      const clientTotals: Record<string, number> = {};
      for (const item of history) {
        Object.keys(item).forEach((key) => {
          if (key !== "date") {
            if (!clientTotals[key]) {
              clientTotals[key] = 0;
            }
            clientTotals[key] += item[key as keyof typeof item];
          }
        });
      }
      const sortedClients = Object.entries(clientTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([client]) => client);

      sortedClients.slice(0, 5).forEach((client) => clientSet.add(client));
    }
    const clients = Array.from(clientSet);

    const config: ChartConfig = {};
    clients.forEach((client, index) => {
      config[client] = {
        label: client,
        color: `var(--chart-${(index % 12) + 1})`,
      };
    });

    return { chartData: history, chartConfig: config, allClients: clients };
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
          <AreaChart data={chartData}>
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
            <ChartTooltip cursor content={<ChartTooltipContent indicator="dot" />} />
            <Legend />
            {allClients.map((client) => (
              <Area
                key={client}
                dataKey={client}
                type="natural"
                fill={chartConfig[client]?.color}
                fillOpacity={0.4}
                stroke={chartConfig[client]?.color}
                stackId="a"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
