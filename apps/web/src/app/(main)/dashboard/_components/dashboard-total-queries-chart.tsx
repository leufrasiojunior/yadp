"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { DashboardTotalQueriesTooltip } from "@/app/(main)/dashboard/_components/dashboard-total-queries-tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { formatDashboardHourTick } from "@/lib/dashboard/dashboard-chart-time";
import { useAppLocale } from "@/lib/i18n/client";

const chartConfig = {
  totalQueries: {
    label: "Total Queries",
    color: "var(--chart-1)",
  },
  blockedQueries: {
    label: "Blocked Queries",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function DashboardTotalQueriesChart({
  description,
  noDataLabel,
  points,
  title,
}: Readonly<{
  description: string;
  noDataLabel: string;
  points: DashboardOverviewResponse["charts"]["totalQueries"]["points"];
  title: string;
}>) {
  const locale = useAppLocale();

  if (points.length === 0) {
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

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <AreaChart data={points}>
            <defs>
              <linearGradient id="fillTotalQueries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalQueries)" stopOpacity={0.9} />
                <stop offset="95%" stopColor="var(--color-totalQueries)" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="fillBlockedQueries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-blockedQueries)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-blockedQueries)" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              minTickGap={32}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => formatDashboardHourTick(value, locale)}
            />
            <ChartTooltip cursor={false} content={<DashboardTotalQueriesTooltip locale={locale} />} />
            <Area
              dataKey="blockedQueries"
              fill="url(#fillBlockedQueries)"
              stroke="var(--color-blockedQueries)"
              type="monotone"
            />
            <Area
              dataKey="totalQueries"
              fill="url(#fillTotalQueries)"
              stroke="var(--color-totalQueries)"
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
