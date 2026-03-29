import { cookies } from "next/headers";

import { DashboardAutoRefresh } from "@/app/(main)/dashboard/_components/dashboard-auto-refresh";
import { DashboardClientActivityChart } from "@/app/(main)/dashboard/_components/dashboard-client-activity-chart";
import { DashboardOverviewToasts } from "@/app/(main)/dashboard/_components/dashboard-overview-toasts";
import { DashboardPartialDataAlert } from "@/app/(main)/dashboard/_components/dashboard-partial-data-alert";
import { DashboardSummaryCards } from "@/app/(main)/dashboard/_components/dashboard-summary-cards";
import { DashboardTotalQueriesChart } from "@/app/(main)/dashboard/_components/dashboard-total-queries-chart";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import {
  getDashboardOverview,
  getInstances,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { DASHBOARD_SCOPE_COOKIE, parseDashboardScope, resolveDashboardScope } from "@/lib/dashboard/dashboard-scope";
import { getServerI18n } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [instances, cookieStore] = await Promise.all([getInstances(), cookies()]);
    const selectedScope = resolveDashboardScope(
      parseDashboardScope(cookieStore.get(DASHBOARD_SCOPE_COOKIE)?.value),
      instances.items,
    );
    const overview =
      selectedScope.kind === "all"
        ? await getDashboardOverview({
            scope: "all",
          })
        : await getDashboardOverview({
            scope: "instance",
            instanceId: selectedScope.instanceId,
          });
    const successfulCount = overview.sources.successfulInstances.length;

    return (
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <DashboardAutoRefresh />
        <DashboardOverviewToasts failedInstances={overview.sources.failedInstances} />
        <div>
          <p className="text-muted-foreground text-sm">{messages.dashboard.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.dashboard.title}</h1>
        </div>

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
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return (
        <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/dashboard" />
      );
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/dashboard"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
