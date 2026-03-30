"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardClientActivityChart } from "@/app/(main)/dashboard/_components/dashboard-client-activity-chart";
import { DashboardOverviewToasts } from "@/app/(main)/dashboard/_components/dashboard-overview-toasts";
import { DashboardPartialDataAlert } from "@/app/(main)/dashboard/_components/dashboard-partial-data-alert";
import { DashboardSummaryCards } from "@/app/(main)/dashboard/_components/dashboard-summary-cards";
import { DashboardTotalQueriesChart } from "@/app/(main)/dashboard/_components/dashboard-total-queries-chart";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { DASHBOARD_AUTO_REFRESH_INTERVAL_MS } from "@/lib/dashboard/dashboard-refresh";
import { useWebI18n } from "@/lib/i18n/client";

type DashboardLiveOverviewProps = {
  initialOverview: DashboardOverviewResponse;
};

export function DashboardLiveOverview({ initialOverview }: Readonly<DashboardLiveOverviewProps>) {
  const client = useMemo(() => getBrowserApiClient(), []);
  const refreshInFlightRef = useRef(false);
  const { locale, messages } = useWebI18n();
  const [overview, setOverview] = useState(initialOverview);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  useEffect(() => {
    async function refreshOverview() {
      if (refreshInFlightRef.current || document.visibilityState !== "visible") {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const { data, response } = await client.GET<DashboardOverviewResponse>("/dashboard/overview", {
          params: {
            query:
              overview.scope.mode === "all"
                ? {
                    scope: "all",
                  }
                : {
                    scope: "instance",
                    instanceId: overview.scope.instanceId ?? undefined,
                  },
          },
        });

        if (!response.ok || !data) {
          return;
        }

        setOverview(data);
      } finally {
        refreshInFlightRef.current = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshOverview();
    }, DASHBOARD_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [client, overview.scope.instanceId, overview.scope.mode]);

  const successfulCount = overview.sources.successfulInstances.length;

  return (
    <>
      <DashboardOverviewToasts failedInstances={overview.sources.failedInstances} />

      <DashboardPartialDataAlert
        failedInstances={overview.sources.failedInstances}
        locale={locale}
        totalInstances={overview.sources.totalInstances}
      />

      <DashboardSummaryCards locale={locale} summary={overview.summary} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <DashboardTotalQueriesChart
          description={messages.dashboard.charts.totalQueriesDescription(successfulCount)}
          noDataLabel={messages.dashboard.charts.noData}
          points={overview.charts.totalQueries.points}
          title={messages.dashboard.charts.totalQueriesTitle}
        />
        <DashboardClientActivityChart
          description={messages.dashboard.charts.clientActivityDescription(successfulCount)}
          noDataLabel={messages.dashboard.charts.noData}
          series={overview.charts.clientActivity.series}
          title={messages.dashboard.charts.clientActivityTitle}
        />
      </div>
    </>
  );
}
