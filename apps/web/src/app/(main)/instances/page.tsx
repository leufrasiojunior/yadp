import { Binary, ShieldCheck } from "lucide-react";

import { InstancesWorkspace } from "@/app/(main)/instances/_components/instances-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstances } from "@/lib/api/yapd-server";

export default async function InstancesPage() {
  const instances = await getInstances();
  const baseline = instances.items.find((item) => item.isBaseline);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Infraestrutura gerenciada</p>
          <h1 className="font-semibold text-3xl tracking-tight">Instances</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="min-w-60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle className="text-base">Baseline</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{baseline?.name ?? "Nao configurada"}</p>
              <p className="text-muted-foreground">{baseline?.baseUrl ?? "-"}</p>
            </CardContent>
          </Card>
          <Card className="min-w-60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Binary className="size-4 text-primary" />
              <CardTitle className="text-base">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{instances.items.length} instancias</p>
              <p className="text-muted-foreground">Incluindo a baseline principal.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <InstancesWorkspace initialItems={instances.items} />
    </div>
  );
}
