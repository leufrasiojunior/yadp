import { BellRing } from "lucide-react";

import { NotificationsWorkspace } from "@/app/(main)/notifications/_components/notifications-workspace";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getNotifications, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotificationsPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const notifications = await getNotifications({
      page: 1,
      pageSize: FRONTEND_CONFIG.notifications.defaultPageSize,
      readState: "unread",
    });

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{messages.notifications.eyebrow}</p>
            <h1 className="font-semibold text-3xl tracking-tight">{messages.notifications.title}</h1>
            <p className="mt-2 text-muted-foreground">{messages.notifications.description}</p>
          </div>
        </div>

        <NotificationsWorkspace initialData={notifications} />
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen fullscreen={false} locale={locale} retryHref="/notifications" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/notifications"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
