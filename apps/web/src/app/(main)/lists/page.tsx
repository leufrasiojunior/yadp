import { ListsWorkspace } from "@/app/(main)/lists/_components/lists-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getGroups, getLists, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function ListsPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [lists, groups] = await Promise.all([getLists(), getGroups()]);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.lists.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.lists.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.lists.description}</p>
        </div>

        <ListsWorkspace initialItems={lists.items} initialSource={lists.source} groups={groups.items} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/lists" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/lists"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
