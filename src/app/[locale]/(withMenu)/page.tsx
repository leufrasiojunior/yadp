"use client"

import { useEffect, useState } from "react"
import { SummaryCard } from "@/components/features/summary/SummaryCard"
import type { PiholeConfig, Summary } from "@/types/api/summary"
import { FaChartPie, FaBan, FaPercent, FaGlobe } from "react-icons/fa"
import { useRouter } from "next/navigation"
import { usePiholeFetch } from "@/services/pihole/usePiholeFetch"

export default function SummaryPage() {
  const router = useRouter()
  const { piholeFetch } = usePiholeFetch()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    const tsStr = localStorage.getItem("yapdAuthTime")
    if (!tsStr || Date.now() - Number(tsStr) > 24 * 60 * 60 * 1000) {
      router.replace("/login")
      return
    }

    async function loadAll() {
      try {
        const confRes = await fetch("/api/piholes")
        if (!confRes.ok) throw new Error("Falha ao ler configuração")
        const { piholes } = (await confRes.json()) as { piholes: PiholeConfig[] }

        let total = 0
        let blocked = 0
        let unique = 0

        for (const { url } of piholes) {
          const data = (await piholeFetch(
            `/api/stats/summary?url=${encodeURIComponent(url)}`,
            url
          )) as Summary
          total += data.queries.total
          blocked += data.queries.blocked
          unique += data.queries.unique_domains
        }

        const percent_blocked = total > 0 ? (blocked * 100) / total : 0
        setSummary({
          queries: {
            total,
            blocked,
            percent_blocked,
            unique_domains: unique,
          },
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [router, piholeFetch])

  if (loading) return <p>Conectando aos Pi-holes…</p>
  if (error) return <p className="text-red-500">Erro: {error}</p>

  if (!summary) return <p>Nenhum dado carregado.</p>

  return (
    <div className="flex flex-row justify-center gap-4">
      <SummaryCard title="Total" value={summary.queries.total} icon={<FaChartPie className="w-12 h-12 text-muted-foreground" />} />
      <SummaryCard title="Blocked" value={summary.queries.blocked} icon={<FaBan className="w-12 h-12 text-muted-foreground" />} />
      <SummaryCard title="% Blocked" value={summary.queries.percent_blocked} isPercentage icon={<FaPercent className="w-12 h-12 text-muted-foreground" />} />
      <SummaryCard title="Unique Domains" value={summary.queries.unique_domains} icon={<FaGlobe className="w-12 h-12 text-muted-foreground" />} />
    </div>
  )
}
