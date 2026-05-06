import { redirect } from "next/navigation";

import { SetupForm } from "@/app/(external)/setup/_components/setup-form";
import { getSetupCopy } from "@/app/(external)/setup/setup-copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { LanguageSelect } from "@/components/yapd/language-select";
import {
  getServerSession,
  getSetupStatus,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function SetupPage() {
  const { locale } = await getServerI18n();
  const copy = getSetupCopy(locale);

  try {
    const setup = await getSetupStatus();

    if (!setup.needsSetup) {
      const session = await getServerSession();
      redirect(session ? "/dashboard" : "/login");
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
        <div className="w-full space-y-6">
          <div className="flex justify-end">
            <LanguageSelect triggerClassName="min-w-52" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{copy.page.formTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <SetupForm />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen locale={locale} retryHref="/setup" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          locale={locale}
          message={error.message}
          retryHref="/setup"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
