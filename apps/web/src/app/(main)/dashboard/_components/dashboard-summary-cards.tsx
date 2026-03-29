import { Activity, Ban, Globe, Percent } from "lucide-react";

import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { getWebMessages } from "@/lib/i18n/messages";

import { DashboardSummaryCard } from "./dashboard-summary-card";

export function DashboardSummaryCards({
  locale,
  summary,
}: Readonly<{
  locale: "pt-BR" | "en-US";
  summary: DashboardOverviewResponse["summary"];
}>) {
  const messages = getWebMessages(locale);
  const integerFormatter = new Intl.NumberFormat(locale);
  const percentageFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
      <DashboardSummaryCard
        icon={Activity}
        title={messages.dashboard.cards.totalQueries}
        value={integerFormatter.format(summary.totalQueries)}
      />
      <DashboardSummaryCard
        icon={Ban}
        title={messages.dashboard.cards.queriesBlocked}
        value={integerFormatter.format(summary.queriesBlocked)}
      />
      <DashboardSummaryCard
        icon={Percent}
        title={messages.dashboard.cards.percentageBlocked}
        value={`${percentageFormatter.format(summary.percentageBlocked)}%`}
      />
      <DashboardSummaryCard
        icon={Globe}
        title={messages.dashboard.cards.domainsOnList}
        value={integerFormatter.format(summary.domainsOnList)}
      />
    </div>
  );
}
