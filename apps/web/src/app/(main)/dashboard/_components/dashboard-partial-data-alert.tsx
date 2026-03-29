import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { getWebMessages } from "@/lib/i18n/messages";

export function DashboardPartialDataAlert({
  failedInstances,
  locale,
  totalInstances,
}: Readonly<{
  failedInstances: DashboardOverviewResponse["sources"]["failedInstances"];
  locale: "pt-BR" | "en-US";
  totalInstances: number;
}>) {
  const messages = getWebMessages(locale);

  if (failedInstances.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{messages.dashboard.partial.title}</AlertTitle>
      <AlertDescription>
        <p>{messages.dashboard.partial.description(failedInstances.length, totalInstances)}</p>
        <div className="mt-3 space-y-1">
          {failedInstances.map((failure) => (
            <p key={failure.instanceId}>
              <strong>{failure.instanceName}:</strong> {failure.message}
            </p>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
