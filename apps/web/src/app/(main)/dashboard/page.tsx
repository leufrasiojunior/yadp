import { cookies } from "next/headers";

import { DashboardLiveOverview } from "@/app/(main)/dashboard/_components/dashboard-live-overview";
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
    const [instances, cookieStore] = await Promise.all([getInstances({ operationalOnly: true }), cookies()]);
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
    return (
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.dashboard.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.dashboard.title}</h1>
        </div>
        <DashboardLiveOverview initialOverview={overview} />
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
