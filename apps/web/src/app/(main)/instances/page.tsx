import { InstancesWorkspace } from "@/app/(main)/instances/_components/instances-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getInstances, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function InstancesPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const instances = await getInstances();

    return (
      <div className="space-y-6">
        <div>
          <div>
            <p className="text-muted-foreground text-sm">{messages.forms.instances.page.eyebrow}</p>
            <h1 className="font-semibold text-3xl tracking-tight">{messages.forms.instances.page.title}</h1>
          </div>
        </div>

        <InstancesWorkspace initialItems={instances.items} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return (
        <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/instances" />
      );
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/instances"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
