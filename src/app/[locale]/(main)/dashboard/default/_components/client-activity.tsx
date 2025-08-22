"use client";

import type { Locale as DateFnsLocale } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatUnixTime } from "@/lib/utils";

import dataJson from "./data.json";

// Tipos para data.json
interface ClientInfo {
  name: string | null;
  total: number;
}

interface RawData {
  history: {
    timestamp: number;
    data: Record<string, number>;
  }[];
  clients: Record<string, ClientInfo>;
  took: number;
}

const rawData: RawData = dataJson as RawData;

// Filtra clientes com valores > 0
const activeKeys = Object.keys(rawData.clients).filter((key) =>
  rawData.history.some((entry) => (entry.data[key] ?? 0) > 0),
);

// Gera chaves seguras
const safeKeyMap = Object.fromEntries(activeKeys.map((k) => [k, k.replace(/\./g, "_")]));

// Prepara chartData
const chartData = rawData.history.map((entry) => {
  const row: Record<string, number | string> = { timestamp: entry.timestamp };
  for (const k of activeKeys) {
    row[safeKeyMap[k]] = entry.data[k] ?? 0;
  }
  return row;
});

// Configuração dinâmica
const chartConfig: ChartConfig = Object.fromEntries(
  activeKeys.map((k, idx) => [
    safeKeyMap[k],
    {
      label: rawData.clients[k]?.name ?? k,
      color: `var(--chart-${(idx % 12) + 1})`,
    },
  ]),
);

// Componente customizado para o tooltip
const CustomTooltipContent = ({ active, payload, label, ...props }: any) => {
  if (!active || !payload) return null;

  // Filtra apenas itens com valor > 0
  const filteredPayload = payload.filter((item: any) => (item.value as number) > 0);

  return <ChartTooltipContent active={active} payload={filteredPayload} label={label} {...props} />;
};

export function ChartClientArea() {
  const t = useTranslations("dashboard.historyChart");
  const locale = useLocale(); // e.g. "pt-BR"
  const dfnsLocale: DateFnsLocale | undefined = mapToDateFnsLocale(locale);

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
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string | number) => safeFormatUnixTime(value, "HH:mm", dfnsLocale)}
            />
            <ChartTooltip content={<CustomTooltipContent />} />
            <YAxis tickLine axisLine />
            {activeKeys.map((k) => (
              <Bar
                key={k}
                dataKey={safeKeyMap[k]}
                stackId="a"
                fill={chartConfig[safeKeyMap[k]].color}
                radius={[0, 0, 4, 4]}
              />
            ))}
          </BarChart>
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
