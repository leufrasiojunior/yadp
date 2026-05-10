import { cookies } from "next/headers";

import { OverviewWorkspace } from "@/app/(main)/overview/_components/overview-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import {
  getInstances,
  getOverview,
  getOverviewJobs,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { DASHBOARD_SCOPE_COOKIE, parseDashboardScope, resolveDashboardScope } from "@/lib/dashboard/dashboard-scope";
import { getServerI18n, getServerTimeZone } from "@/lib/i18n/server";
import {
  buildOverviewQueryFromFilters,
  normalizeOverviewFilters,
  normalizeOverviewTab,
} from "@/lib/overview/overview-filters";

export default async function OverviewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { locale } = await getServerI18n();

  try {
    const [instances, cookieStore, timeZone, resolvedSearchParams] = await Promise.all([
      getInstances({ operationalOnly: true }),
      cookies(),
      getServerTimeZone(),
      searchParams,
    ]);
    const selectedScope = resolveDashboardScope(
      parseDashboardScope(cookieStore.get(DASHBOARD_SCOPE_COOKIE)?.value),
      instances.items,
    );
    const filters = normalizeOverviewFilters(resolvedSearchParams, timeZone);
    const activeTab = normalizeOverviewTab(resolvedSearchParams);
    const overviewQuery = buildOverviewQueryFromFilters(filters, timeZone);
    const initialOverview =
      selectedScope.kind === "all"
        ? await getOverview({
            scope: "all",
            ...overviewQuery,
          })
        : await getOverview({
            scope: "instance",
            instanceId: selectedScope.instanceId,
            ...overviewQuery,
          });
    const initialJobs = await getOverviewJobs();

    return (
      <OverviewWorkspace
        initialFilters={filters}
        initialJobs={initialJobs}
        initialOverview={initialOverview}
        initialTab={activeTab}
        scope={selectedScope}
      />
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/overview" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/overview"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
