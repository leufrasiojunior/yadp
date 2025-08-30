"use client";

import { useMemo } from "react";

import type { Locale as DateFnsLocale } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { usePiholeTopClients } from "@/hooks/use-pihole-top-clients";
import { mapToDateFnsLocale, safeFormatUnixTime } from "@/lib/helpers";
import { ChartDataPoint } from "@/types/pihole";

export function ChartClientArea() {
  const t = useTranslations("dashboard.clientActivityChart");
  const tNoData = useTranslations("dashboard.clientActivityChart.noData");
  const locale = useLocale();
  const { chartData, chartConfig, activeKeys, loading } = usePiholeTopClients();

  const dfnsLocale: DateFnsLocale | undefined = mapToDateFnsLocale(locale);

  // Processamento dos dados e configuração do XAxis
  const processedData = useMemo(() => {
    if (!chartData?.length) {
      return {
        data: [],
        tickFormatter: (value: number) => safeFormatUnixTime(value, "HH:mm", dfnsLocale),
        hasValidData: false,
      };
    }

    // Processa os dados garantindo timestamps válidos
    const validData = chartData
      .map((item: ChartDataPoint) => {
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
  }, [chartData, dfnsLocale]);

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

  // Verifica se há dados válidos após o processamento
  if (!processedData.hasValidData) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{tNoData("title")}</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">{tNoData("description")}</span>
            <span className="@[540px]/card:hidden">{tNoData("description_mobile")}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="text-muted-foreground flex h-[250px] items-center justify-center">{tNoData("message")}</div>
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
          <BarChart accessibilityLayer data={processedData.data}>
            <CartesianGrid vertical={false} />

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

            {/* Tooltip */}
            <ChartTooltip
              cursor
              allowEscapeViewBox={{ x: true, y: true }}
              content={({ payload }) => {
                if (!payload?.length) return null;

                // ponto bruto (pega do primeiro item)
                const point = payload[0].payload as ChartDataPoint;
                const rawTs = point?.date ?? point?.timestamp;

                // Monta os itens com label/cores vindos do chartConfig
                const items = payload
                  .filter((entry) => {
                    const value = Number(entry.value);
                    return !isNaN(value) && value > 0;
                  })
                  .map((entry) => {
                    const key = String(entry.dataKey);
                    const cfg = (chartConfig as ChartConfig)[key] ?? {};
                    const name = cfg.label ?? key;
                    return {
                      key,
                      name,
                      color: entry.color,
                      value: entry.value,
                    };
                  });

                const tsLabel = safeFormatUnixTime(rawTs, "d MMM, HH:mm", dfnsLocale);

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
                    </div>
                  </div>
                );
              }}
            />

            {Object.keys(chartConfig).map((dataKey) => {
              const color = chartConfig[dataKey]?.color ?? "hsl(var(--chart-1))";
              return <Bar key={dataKey} dataKey={dataKey} stackId="a" fill={color} radius={[0, 0, 4, 4]} />;
            })}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
