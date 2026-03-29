import type { LucideIcon } from "lucide-react";

import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardSummaryCard({
  icon: Icon,
  title,
  value,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  value: string;
}>) {
  return (
    <Card className="@container/card border-border/60 bg-linear-to-t from-primary/5 to-card shadow-xs">
      <CardHeader>
        <CardAction className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </CardAction>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
