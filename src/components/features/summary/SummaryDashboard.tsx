import { SummaryCard } from "@/components/features/summary/SummaryCard"
import type { Summary } from "@/types/api/summary"
import { FaChartPie, FaBan, FaPercent, FaGlobe } from "react-icons/fa"

interface SummaryDashboardProps {
  summary: Summary
}

export function SummaryDashboard({ summary }: SummaryDashboardProps) {
  return (
    <div className="flex flex-row justify-center gap-4">
      <SummaryCard
        title="Total"
        value={summary.queries.total}
        icon={<FaChartPie className="w-12 h-12 text-muted-foreground" />}
      />
      <SummaryCard
        title="Blocked"
        value={summary.queries.blocked}
        icon={<FaBan className="w-12 h-12 text-muted-foreground" />}
      />
      <SummaryCard
        title="% Blocked"
        value={summary.queries.percent_blocked}
        isPercentage
        icon={<FaPercent className="w-12 h-12 text-muted-foreground" />}
      />
      <SummaryCard
        title="Unique Domains"
        value={summary.queries.unique_domains}
        icon={<FaGlobe className="w-12 h-12 text-muted-foreground" />}
      />
    </div>
  )
}