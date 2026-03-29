import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import {
  getInstances,
  getServerSession,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const { locale, messages } = await getServerI18n();
  try {
    const [instances, session] = await Promise.all([getInstances(), getServerSession(true)]);

    if (!session) {
      return null;
    }

    const baseline = instances.items.find((item) => item.isBaseline);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">{messages.dashboard.eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{messages.dashboard.title}</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>{messages.dashboard.cards.instances}</CardDescription>
              <CardTitle className="text-3xl">{instances.items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{messages.dashboard.cards.baseline}</CardDescription>
              <CardTitle className="text-xl">{baseline?.name ?? messages.common.notConfigured}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {baseline?.baseUrl ?? messages.dashboard.cards.setupHint}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{messages.dashboard.cards.session}</CardDescription>
              <CardTitle className="text-xl">{session.baseline.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {messages.dashboard.cards.expiresAt(
                new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(session.expiresAt),
                ),
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{messages.dashboard.sliceTitle}</CardTitle>
              <CardDescription>{messages.dashboard.sliceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6">
              <p>{messages.dashboard.sliceBodyPrimary}</p>
              <p>{messages.dashboard.sliceBodySecondary}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{messages.dashboard.nextTitle}</CardTitle>
              <CardDescription>{messages.dashboard.nextDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{messages.dashboard.nextBodyPrimary}</p>
              <p>{messages.dashboard.nextBodySecondary}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return (
        <ApiUnavailableScreen apiBaseUrl={error.baseUrl} fullscreen={false} locale={locale} retryHref="/dashboard" />
      );
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          fullscreen={false}
          locale={locale}
          message={error.message}
          retryHref="/dashboard"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
