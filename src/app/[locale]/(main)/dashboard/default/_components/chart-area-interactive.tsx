"use client";

import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePiholeHistory } from "@/hooks/use-pihole-history";
import { formatUnixTime } from "@/lib/utils";

export const description = "An interactive area chart";

export function ChartAreaInteractive() {
  const t = useTranslations("dashboard.historyChart");
  const locale = useLocale();
  const { history, loading, error } = usePiholeHistory();
  const isMobile = useIsMobile();

  const chartConfig = {
    date: {
      label: t("tooltip_total"),
    },
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

  const formatDate = (value: string | number) => {
    console.log("Tooltip value:", value); // <-- veja no console
    const date =
      typeof value === "number" && value < 1e12
        ? new Date(value * 1000) // timestamp em segundos
        : new Date(value);

    if (isNaN(date.getTime())) {
      return String(value); // fallback pra não quebrar
    }

    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

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
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={
                (value) => formatUnixTime(value, "HH:mm") // apenas hora:minuto
              }
            />
            <YAxis tickLine={true} axisLine={true} />
            <ChartTooltip
              cursor={true}
              defaultIndex={isMobile ? -1 : 10}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const rawDate = payload?.[0]?.payload?.date;
                    return rawDate
                      ? formatUnixTime(rawDate, "d MMM, HH:mm") // dia abreviado + hora:min
                      : "";
                  }}
                  indicator="dot"
                />
              }
            />
            <Area dataKey="total" type="natural" fill="url(#fillTotal)" stroke="var(--chart-1)" stackId="a" />
            <Area dataKey="blocked" type="natural" fill="url(#fillBlocked)" stroke="var(--chart-5)" stackId="b" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
