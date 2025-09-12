"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregatedPiholeQuery } from "@/hooks/use-aggregated-pihole-query";

// Logic from usePiholeQueryTypes hook
interface QueryTypesData {
  types: Record<string, number>;
}

const initialData: QueryTypesData = { types: {} };

const queryTypesAggregator = (results: QueryTypesData[]): QueryTypesData => {
  if (results.length === 0) {
    return initialData;
  }
  return results[0];
};
// End of logic from usePiholeQueryTypes hook

export function ChartPieTopQueryes() {
  const t = useTranslations("dashboard.query_types");

  // Inlined hook logic
  const { data, loading } = useAggregatedPiholeQuery<QueryTypesData, QueryTypesData>(
    "stats/query_types",
    queryTypesAggregator,
    initialData,
    // 10000,
  );

  const { chartData, chartConfig } = useMemo(() => {
    if (!data || !data.types) {
      return { chartData: [], chartConfig: {} };
    }

    const parsedData = Object.entries(data.types)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: key,
        value: value,
      }));

    const chartConfig = Object.fromEntries(
      parsedData.map((entry, idx) => [
        entry.name,
        {
          label: entry.name,
          color: `var(--chart-${(idx % 12) + 1})`,
        },
      ]),
    );

    return { chartData: parsedData, chartConfig };
  }, [data]);
  // End of inlined hook logic

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
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
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip content={<ChartTooltipContent />} />
              <Pie data={chartData} dataKey="value" nameKey="name" />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
