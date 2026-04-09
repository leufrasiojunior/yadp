import { GroupsWorkspace } from "@/app/(main)/groups/_components/groups-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getGroups, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function GroupsPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const groups = await getGroups();

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.groups.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.groups.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.groups.description}</p>
        </div>

        <GroupsWorkspace initialData={groups} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/groups" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/groups"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
