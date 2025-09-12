"use client";

import { Blocks, CircleSlash, Database, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregatedPiholeQuery } from "@/hooks/use-aggregated-pihole-query";
import { PiholeSummary } from "@/types/pihole";

// Logic from usePiholeSummary hook
const initialData: PiholeSummary = {
  queries: {
    total: 0,
    blocked: 0,
    percent_blocked: 0,
    unique_domains: 0,
    forwarded: 0,
    cached: 0,
    frequency: 0,
    types: {},
    status: {},
    replies: {},
  },
  clients: { active: 0, total: 0 },
  gravity: { domains_being_blocked: 0, last_update: 0 },
  took: 0,
};

const summaryAggregator = (results: PiholeSummary[]): PiholeSummary => {
  const aggregated = results.reduce(
    (acc, current) => {
      acc.queries.total += current.queries.total;
      acc.queries.blocked += current.queries.blocked;
      acc.gravity.domains_being_blocked += current.gravity.domains_being_blocked;
      return acc;
    },
    JSON.parse(JSON.stringify(initialData)), // Deep copy to avoid mutation
  );

  if (aggregated.queries.total > 0) {
    aggregated.queries.percent_blocked = (aggregated.queries.blocked / aggregated.queries.total) * 100;
  }

  return aggregated;
};
// End of logic from usePiholeSummary hook

export function SectionCards() {
  const t = useTranslations("dashboard.cards");

  // Inlined hook logic
  const { data: summary, loading } = useAggregatedPiholeQuery<PiholeSummary, PiholeSummary>(
    "stats/summary",
    summaryAggregator,
    initialData,
    // 10000,
  );
  // End of inlined hook logic

  const cardContent = [
    {
      title: t("queriesTotal.title"),
      value: summary?.queries.total.toLocaleString(),
      icon: <Database className="text-muted-foreground h-4 w-4" />,
    },
    {
      title: t("queriesBlocked.title"),
      value: summary?.queries.blocked.toLocaleString(),
      icon: <ShieldCheck className="text-muted-foreground h-4 w-4" />,
    },
    {
      title: t("queriesPercent.title"),
      value: `${summary?.queries.percent_blocked.toFixed(2)}%`,
      icon: <CircleSlash className="text-muted-foreground h-4 w-4" />,
    },
    {
      title: t("totalDomains.title"),
      value: summary?.gravity.domains_being_blocked.toLocaleString(),
      icon: <Blocks className="text-muted-foreground h-4 w-4" />,
    },
  ];

  if (loading && !summary?.queries.total) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cardContent.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
