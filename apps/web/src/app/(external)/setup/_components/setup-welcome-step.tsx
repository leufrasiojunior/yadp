import { Waypoints } from "lucide-react";

import type { SetupCopy } from "@/app/(external)/setup/setup-copy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupWelcomeStep({ copy }: Readonly<{ copy: SetupCopy["welcome"] }>) {
  return (
    <Card className="border-primary/15 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Waypoints className="size-4" />
          <span className="font-medium text-sm uppercase tracking-[0.18em]">{copy.eyebrow}</span>
        </div>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">
        <div className="rounded-xl border bg-background/70 p-4">{copy.primary}</div>
        <div className="rounded-xl border bg-background/70 p-4">{copy.secondary}</div>
      </CardContent>
    </Card>
  );
}
