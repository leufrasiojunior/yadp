import { Binary, ShieldCheck } from "lucide-react";

import { InstancesWorkspace } from "@/app/(main)/instances/_components/instances-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getInstances, isYapdApiResponseError, isYapdApiUnavailableError } from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function InstancesPage() {
  const { locale, messages } = await getServerI18n();

  try {
    const instances = await getInstances();
    const baseline = instances.items.find((item) => item.isBaseline);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{messages.forms.instances.page.eyebrow}</p>
            <h1 className="font-semibold text-3xl tracking-tight">{messages.forms.instances.page.title}</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="min-w-60">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <ShieldCheck className="size-4 text-primary" />
                <CardTitle className="text-base">{messages.common.baseline}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium">{baseline?.name ?? messages.common.notConfigured}</p>
                <p className="text-muted-foreground">{baseline?.baseUrl ?? "-"}</p>
              </CardContent>
            </Card>
            <Card className="min-w-60">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Binary className="size-4 text-primary" />
                <CardTitle className="text-base">{messages.common.total}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium">{messages.forms.instances.page.totalDescription(instances.items.length)}</p>
                <p className="text-muted-foreground">{messages.forms.instances.page.totalCaption}</p>
              </CardContent>
            </Card>
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
