import { redirect } from "next/navigation";

import { LockKeyhole, ShieldCheck, Workflow } from "lucide-react";

import { PiholeLoginForm } from "@/app/(external)/login/_components/pihole-login-form";
import { YapdPasswordLoginForm } from "@/app/(external)/login/_components/yapd-password-login-form";
import { getLoginCopy } from "@/app/(external)/login/login-copy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function LoginPage() {
  const { locale } = await getServerI18n();
  const copy = getLoginCopy(locale);

  try {
    const setup = await getSetupStatus();

    if (setup.needsSetup || !setup.baseline || !setup.loginMode) {
      redirect("/setup");
    }

    const session = await getServerSession();

    if (session) {
      redirect("/dashboard");
    }

    const modeCopy = copy.modes[setup.loginMode];
    const formCopy = {
      fields: modeCopy.fields,
      validationPassword: modeCopy.validationPassword,
      submit: modeCopy.submit,
      successToast: modeCopy.successToast(setup.baseline.name),
    };

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <div className="w-full space-y-6">
          <div className="flex justify-end">
            <LanguageSelect triggerClassName="min-w-52" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                  <ShieldCheck className="size-5" />
                  <span className="font-medium text-sm uppercase tracking-[0.24em]">{modeCopy.badge}</span>
                </div>
                <CardTitle className="text-4xl tracking-tight">{modeCopy.title}</CardTitle>
                <CardDescription className="max-w-xl text-base leading-7">{modeCopy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6">
                <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                  <LockKeyhole className="mt-0.5 size-4 text-primary" />
                  <p>{modeCopy.primaryNote}</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                  <Workflow className="mt-0.5 size-4 text-primary" />
                  <p>{modeCopy.secondaryNote}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{modeCopy.cardTitle(setup.baseline.name)}</CardTitle>
                <CardDescription>{modeCopy.cardDescription(setup.baseline.baseUrl)}</CardDescription>
              </CardHeader>
              <CardContent>
                {setup.loginMode === "pihole-master" ? (
                  <PiholeLoginForm copy={formCopy} />
                ) : (
                  <YapdPasswordLoginForm copy={formCopy} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return (
        <ApiUnavailableScreen
          apiBaseUrl={error.baseUrl}
          description={copy.unavailableDescription}
          locale={locale}
          retryHref="/login"
          title={copy.unavailableTitle}
        />
      );
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          locale={locale}
          message={error.message}
          retryHref="/login"
          status={error.status}
          title={copy.unavailableTitle}
        />
      );
    }

    throw error;
  }
}
