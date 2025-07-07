import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatNumber, formatPercent } from "@/lib/formatter";

interface SummaryCardProps {
  title: string;
  value: number;
  isPercentage?: boolean;
  icon?: React.ReactNode;
}

export function SummaryCard({
  title,
  value,
  isPercentage = false,
  icon,
}: SummaryCardProps) {
  return (
    <Card className="w-80 bg-muted text-center transition-transform hover:scale-105">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Separator />
      </CardHeader>

      <CardContent className="flex items-center justify-center gap-3">
        <div className="w-16 h-16 flex items-center justify-center">
          {icon}
        </div>
        <div className="text-3xl font-bold">
          {isPercentage ? formatPercent(value) : formatNumber(value)}
        </div>
      </CardContent>

    </Card>
  );
}
