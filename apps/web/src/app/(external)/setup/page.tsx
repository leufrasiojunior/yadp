import { redirect } from "next/navigation";

import { Server, ShieldCheck, Waypoints } from "lucide-react";

import { SetupForm } from "@/app/(external)/setup/_components/setup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getServerSession, getSetupStatus, isYapdApiUnavailableError } from "@/lib/api/yapd-server";

export default async function SetupPage() {
  try {
    const setup = await getSetupStatus();

    if (!setup.needsSetup) {
      const session = await getServerSession();
      redirect(session ? "/dashboard" : "/login");
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Waypoints className="size-5" />
                <span className="font-medium text-sm uppercase tracking-[0.24em]">Setup inicial</span>
              </div>
              <CardTitle className="text-4xl tracking-tight">Defina a baseline do YAPD</CardTitle>
              <CardDescription className="max-w-xl text-base leading-7">
                Esse primeiro passo registra a instância Pi-hole que vai autenticar a interface e servir como autoridade
                principal do produto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6">
              <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                <Server className="mt-0.5 size-4 text-primary" />
                <p>
                  O backend valida a conectividade e guarda apenas a credencial técnica da baseline de forma
                  criptografada.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
                <ShieldCheck className="mt-0.5 size-4 text-primary" />
                <p>O login humano do painel vai usar o fluxo oficial do Pi-hole v6 para gerar o SID da sessão proxy.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Configurar baseline</CardTitle>
              <CardDescription>
                Preencha a instância principal do ambiente para liberar o login do produto.
              </CardDescription>
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
      return (
        <ApiUnavailableScreen
          apiBaseUrl={error.baseUrl}
          description="O setup depende do backend para validar a baseline, criptografar o segredo tecnico e salvar a configuracao inicial."
          retryHref="/setup"
          title="Nao foi possivel abrir o setup"
        />
      );
    }

    throw error;
  }
}
