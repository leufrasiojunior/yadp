import { BrowserExtensionWorkspace } from "@/app/(main)/browser-extension/_components/browser-extension-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import {
  getBrowserExtensionDevices,
  getBrowserExtensionDomainDetections,
  getBrowserExtensionSettings,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function BrowserExtensionPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const [settings, devices, detections] = await Promise.all([
      getBrowserExtensionSettings(),
      getBrowserExtensionDevices(),
      getBrowserExtensionDomainDetections({ page: 1, pageSize: 10 }),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.browserExtension.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.browserExtension.title}</h1>
          <p className="mt-2 text-muted-foreground">{messages.browserExtension.description}</p>
        </div>

        <BrowserExtensionWorkspace initialDetections={detections} initialDevices={devices} initialSettings={settings} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/browser-extension" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/browser-extension"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
