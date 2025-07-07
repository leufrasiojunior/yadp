import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/formatter";


interface SummaryCardProps {
  title: string;
  value: number;
  isPercentage?: boolean;
}

export function SummaryCard({ title, value, isPercentage = false }: SummaryCardProps) {
  return (
    <Card className="transition-transform hover:scale-105 w-80 text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{isPercentage ? formatPercent(value) : formatNumber(value)}</CardContent>
    </Card>
  );
}
