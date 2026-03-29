import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebI18n } from "@/lib/i18n/client";

export function SidebarSupportCard() {
  const { messages } = useWebI18n();

  return (
    <Card size="sm" className="shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{messages.sidebar.statusCard.title}</CardTitle>
        <CardDescription>{messages.sidebar.statusCard.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
