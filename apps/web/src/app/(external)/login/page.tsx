import { redirect } from "next/navigation";

import { LockKeyhole, ShieldCheck, Workflow } from "lucide-react";

import { PiholeLoginForm } from "@/app/(external)/login/_components/pihole-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getServerSession, getSetupStatus, isYapdApiUnavailableError } from "@/lib/api/yapd-server";

export default async function LoginPage() {
  try {
    const setup = await getSetupStatus();

    if (setup.needsSetup || !setup.baseline) {
      redirect("/setup");
    }

    const session = await getServerSession();

    if (session) {
      redirect("/dashboard");
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="size-5" />
                <span className="font-medium text-sm uppercase tracking-[0.24em]">Baseline login</span>
              </div>
              <CardTitle className="text-4xl tracking-tight">Entre usando o Pi-hole principal</CardTitle>
              <CardDescription className="max-w-xl text-base leading-7">
                O YAPD usa o endpoint oficial de login do Pi-hole v6 para obter um SID e criar a sessao segura do
                painel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6">
              <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                <LockKeyhole className="mt-0.5 size-4 text-primary" />
                <p>Senha e TOTP sao enviados apenas para a baseline e nao ficam gravados no banco do YAPD.</p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                <Workflow className="mt-0.5 size-4 text-primary" />
                <p>
                  As outras instancias seguem com segredos tecnicos proprios para testes, import e operacoes futuras.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{setup.baseline.name}</CardTitle>
              <CardDescription>{setup.baseline.baseUrl}</CardDescription>
            </CardHeader>
            <CardContent>
              <PiholeLoginForm baseline={setup.baseline} />
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
          description="O login depende do backend para consultar a baseline, abrir a sessao proxy e gravar o cookie seguro do YAPD."
          retryHref="/login"
          title="Nao foi possivel abrir o login"
        />
      );
    }

    throw error;
  }
}
