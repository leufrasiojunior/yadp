import { ConfigWorkspace } from "@/app/(main)/config/_components/config-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getConfigOverview, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function ConfigPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const config = await getConfigOverview();

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.config.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.config.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.config.description}</p>
        </div>

        <ConfigWorkspace initialData={config} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/config" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/config"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
