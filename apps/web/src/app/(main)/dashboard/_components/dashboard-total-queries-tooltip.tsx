"use client";

import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { formatDashboardHourRange } from "@/lib/dashboard/dashboard-chart-time";

type TotalQueriesPoint = DashboardOverviewResponse["charts"]["totalQueries"]["points"][number];

type TooltipPayloadItem = {
  payload?: TotalQueriesPoint;
};

function formatMetricValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPercentage(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function DashboardTotalQueriesTooltip({
  active,
  payload,
  locale,
  timeZone,
}: Readonly<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  locale: string;
  timeZone: string;
}>) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="grid min-w-44 gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium">{formatDashboardHourRange(point.timestamp, locale, timeZone)}</div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium font-mono tabular-nums">{formatMetricValue(point.totalQueries, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Cached</span>
          <span className="font-medium font-mono tabular-nums">{formatMetricValue(point.cachedQueries, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Blocked</span>
          <span className="font-medium font-mono tabular-nums">{formatMetricValue(point.blockedQueries, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Forwarded</span>
          <span className="font-medium font-mono tabular-nums">
            {formatMetricValue(point.forwardedQueries, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">% Blocked</span>
          <span className="font-medium font-mono tabular-nums">
            {formatPercentage(point.percentageBlocked, locale)}%
          </span>
        </div>
      </div>
    </div>
  );
}
