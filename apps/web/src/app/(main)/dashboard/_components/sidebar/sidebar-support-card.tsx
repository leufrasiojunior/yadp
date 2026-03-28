import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SidebarSupportCard() {
  return (
    <Card size="sm" className="shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Slice 1 status</CardTitle>
        <CardDescription>Setup, login and instance management are wired for the first YAPD delivery.</CardDescription>
      </CardHeader>
    </Card>
  );
}
