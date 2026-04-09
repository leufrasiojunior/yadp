import { DomainsWorkspace } from "@/app/(main)/domains/_components/domains-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getDomains, getGroups, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import {
  ALL_DOMAIN_FILTERS,
  DEFAULT_DOMAINS_SORT_DIRECTION,
  DEFAULT_DOMAINS_SORT_FIELD,
} from "@/lib/domains/domains-sorting";
import { getServerI18n } from "@/lib/i18n/server";
import { DEFAULT_MANAGED_ITEMS_PAGE_SIZE } from "@/lib/managed-items/pagination";

export default async function DomainsPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [domains, groups] = await Promise.all([
      getDomains({
        page: 1,
        pageSize: DEFAULT_MANAGED_ITEMS_PAGE_SIZE,
        sortBy: DEFAULT_DOMAINS_SORT_FIELD,
        sortDirection: DEFAULT_DOMAINS_SORT_DIRECTION,
        filters: ALL_DOMAIN_FILTERS,
      }),
      getGroups(),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.domains.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.domains.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.domains.description}</p>
        </div>

        <DomainsWorkspace initialData={domains} groups={groups.items} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/domains" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/domains"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
