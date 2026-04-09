import { DomainsWorkspace } from "@/app/(main)/domains/_components/domains-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getDomains, getGroups, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function DomainsPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [domains, groups] = await Promise.all([getDomains(), getGroups()]);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.domains.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.domains.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.domains.description}</p>
        </div>

        <DomainsWorkspace initialItems={domains.items} initialSource={domains.source} groups={groups.items} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return (
        <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/domains" />
      );
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
