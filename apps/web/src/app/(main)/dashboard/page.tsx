import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstances, getServerSession } from "@/lib/api/yapd-server";

export default async function DashboardPage() {
  const [instances, session] = await Promise.all([getInstances(), getServerSession(true)]);

  if (!session) {
    return null;
  }

  const baseline = instances.items.find((item) => item.isBaseline);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">Primeiro slice operacional do YAPD</p>
        <h1 className="font-semibold text-3xl tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Instancias cadastradas</CardDescription>
            <CardTitle className="text-3xl">{instances.items.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Baseline ativa</CardDescription>
            <CardTitle className="text-xl">{baseline?.name ?? "Nao configurada"}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {baseline?.baseUrl ?? "Configure no setup"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sessao atual</CardDescription>
            <CardTitle className="text-xl">{session.baseline.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Expira em {new Date(session.expiresAt).toLocaleString("pt-BR")}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Estado do slice 1</CardTitle>
            <CardDescription>
              O backend ja responde setup, sessao e gerenciamento inicial de instancias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p>
              Use a pagina de instancias para cadastrar novos Pi-holes, testar a conectividade e revisar a baseline.
            </p>
            <p>O login humano acontece sempre via baseline e o backend guarda apenas a sessao proxy segura.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proximos passos</CardTitle>
            <CardDescription>O que este repositório ja preparou para a proxima fase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Sync engine e drift podem ser encaixados sobre o modulo Pi-hole e o estado canonico.</p>
            <p>Auditoria, trust TLS e segredos criptografados ja estao estruturados no backend.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
