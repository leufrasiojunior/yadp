"use client"

import { useSummaryData } from "@/hooks/useSummaryData"
import { SummaryDashboard } from "@/components/features/summary/SummaryDashboard"

export default function SummaryPage() {
  const { summary, loading, error } = useSummaryData()

  if (loading) return <p>Conectando aos Pi-holes…</p>
  if (error) return <p className="text-red-500">Erro: {error}</p>

  if (!summary) return <p>Nenhum dado carregado.</p>

  return <SummaryDashboard summary={summary} />
}