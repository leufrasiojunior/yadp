"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { formatDashboardHourRange, formatDashboardHourTick } from "@/lib/dashboard/dashboard-chart-time";
import { useAppLocale } from "@/lib/i18n/client";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type ChartRow = {
  timestamp: string;
} & Record<string, number | string>;

export function DashboardClientActivityChart({
  description,
  noDataLabel,
  series,
  title,
}: Readonly<{
  description: string;
  noDataLabel: string;
  series: DashboardOverviewResponse["charts"]["clientActivity"]["series"];
  title: string;
}>) {
  const locale = useAppLocale();

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">{noDataLabel}</CardContent>
      </Card>
    );
  }

  const timestamps = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.timestamp)))).sort();
  const data: ChartRow[] = timestamps.map((timestamp) => {
    const row: ChartRow = { timestamp };

    series.forEach((item) => {
      row[item.key] = item.points.find((point) => point.timestamp === timestamp)?.queries ?? 0;
    });

    return row;
  });

  const chartConfig: ChartConfig = {};

  series.forEach((item, index) => {
    chartConfig[item.key] = {
      label: item.label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              minTickGap={32}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => formatDashboardHourTick(value, locale)}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => formatDashboardHourRange(String(value), locale)}
                />
              }
            />
            {series.map((item) => (
              <Bar key={item.key} dataKey={item.key} fill={`var(--color-${item.key})`} stackId="client-activity" />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
