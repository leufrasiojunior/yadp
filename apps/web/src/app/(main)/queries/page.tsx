import { cookies } from "next/headers";

import { QueriesWorkspace } from "@/app/(main)/queries/_components/queries-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getInstances, getQueries, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { DASHBOARD_SCOPE_COOKIE, parseDashboardScope, resolveDashboardScope } from "@/lib/dashboard/dashboard-scope";
import { getServerI18n } from "@/lib/i18n/server";
import { DEFAULT_QUERIES_LENGTH } from "@/lib/queries/queries-filters";

export default async function QueriesPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [instances, cookieStore] = await Promise.all([getInstances({ operationalOnly: true }), cookies()]);
    const selectedScope = resolveDashboardScope(
      parseDashboardScope(cookieStore.get(DASHBOARD_SCOPE_COOKIE)?.value),
      instances.items,
    );
    const initialData =
      selectedScope.kind === "all"
        ? await getQueries({
            scope: "all",
            length: DEFAULT_QUERIES_LENGTH,
            start: 0,
          })
        : await getQueries({
            scope: "instance",
            instanceId: selectedScope.instanceId,
            length: DEFAULT_QUERIES_LENGTH,
            start: 0,
          });

    return (
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.queries.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.queries.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground text-sm">{messages.queries.description}</p>
        </div>

        <QueriesWorkspace
          key={selectedScope.kind === "all" ? "all" : selectedScope.instanceId}
          initialData={initialData}
          scope={selectedScope}
        />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/queries" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/queries"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
