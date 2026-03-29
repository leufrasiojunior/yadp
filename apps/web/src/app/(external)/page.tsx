import { redirect } from "next/navigation";

import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import {
  getServerSession,
  getSetupStatus,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { getServerLocale } from "@/lib/i18n/server";

export default async function Home() {
  const locale = await getServerLocale();

  try {
    const setup = await getSetupStatus();

    if (setup.needsSetup) {
      redirect("/setup");
    }

    const session = await getServerSession();

    if (session) {
      redirect("/dashboard");
    }

    redirect("/login");
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen apiBaseUrl={error.baseUrl} locale={locale} />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen apiBaseUrl={error.baseUrl} locale={locale} message={error.message} status={error.status} />
      );
    }

    throw error;
  }
}
