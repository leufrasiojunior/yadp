import { redirect } from "next/navigation";

import { ShieldCheck } from "lucide-react";

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
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div className="flex justify-end">
            <LanguageSelect triggerClassName="min-w-52" />
          </div>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                <ShieldCheck className="size-4" />
                <span className="font-medium text-xs uppercase tracking-[0.24em]">{modeCopy.badge}</span>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="font-medium text-primary text-xs uppercase tracking-[0.24em]">
                  {copy.primaryInstanceLabel}
                </p>
                <p className="mt-2 font-semibold text-2xl tracking-tight">{setup.baseline.name}</p>
                <p className="mt-1 break-all text-muted-foreground text-sm">{setup.baseline.baseUrl}</p>
              </div>

              <div className="space-y-1">
                <CardTitle>{formCopy.fields.password}</CardTitle>
                <CardDescription>{formCopy.fields.passwordDescription}</CardDescription>
              </div>
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
