import { cookies } from "next/headers";

import { ClientsWorkspace } from "@/app/(main)/clients/_components/clients-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getClients, getGroups, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { CLIENTS_EXCLUDED_TAGS_COOKIE, parseExcludedClientTagsCookie } from "@/lib/clients/client-tags";
import { DEFAULT_CLIENTS_PAGE_SIZE } from "@/lib/clients/clients-pagination";
import { DEFAULT_CLIENTS_SORT_DIRECTION, DEFAULT_CLIENTS_SORT_FIELD } from "@/lib/clients/clients-sorting";
import { getServerI18n } from "@/lib/i18n/server";

export default async function ClientsPage() {
  const [{ locale, messages }, cookieStore] = await Promise.all([getServerI18n(), cookies()]);
  const initialExcludedTags = parseExcludedClientTagsCookie(cookieStore.get(CLIENTS_EXCLUDED_TAGS_COOKIE)?.value);

  try {
    const [clients, groups] = await Promise.all([
      getClients({
        page: 1,
        pageSize: DEFAULT_CLIENTS_PAGE_SIZE,
        sortBy: DEFAULT_CLIENTS_SORT_FIELD,
        sortDirection: DEFAULT_CLIENTS_SORT_DIRECTION,
        excludedTags: initialExcludedTags,
      }),
      getGroups(),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.clients.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.clients.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.clients.description}</p>
        </div>

        <ClientsWorkspace
          initialData={clients}
          initialExcludedTags={initialExcludedTags}
          initialGroups={groups.items}
        />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/clients" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/clients"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
