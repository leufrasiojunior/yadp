"use client"

import { useEffect, useState } from "react"
import { SummaryCard } from "@/components/features/summary/SummaryCard"
import type { PiholeConfig, Summary } from "@/types/api/summary"
import type { AuthData } from "@/services/pihole/auth"
import { login } from "@/services/pihole/auth"
import { FaChartPie, FaBan, FaPercent, FaGlobe } from "react-icons/fa"
import HistoryViewer from "@/components/features/HistoryViewer/HistoryViewer"
import { useRouter } from "next/navigation"

export default function SummaryPage() {
  const router = useRouter()
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

        let storedAuth: Record<string, AuthData> = {}
        const raw = localStorage.getItem("piholesAuth")
        if (raw) {
          try {
            storedAuth = JSON.parse(raw)
          } catch { }
        }

        let total = 0
        let blocked = 0
        let unique = 0

        for (const { url, password } of piholes) {
          let creds = storedAuth[url]
          // Se não houver credenciais armazenadas, tenta autenticar
          if (!creds) {
            try {
              creds = await login(url, password)
              storedAuth[url] = creds
              localStorage.setItem("piholesAuth", JSON.stringify(storedAuth))
            } catch {
              throw new Error(`Sem autenticação para ${url}`)
            }
          }

          const endpoint = "/api/stats/summary"
          let summaryRes = await fetch(
            `${endpoint}?url=${encodeURIComponent(url)}`,
            { headers: { "X-FTL-SID": creds.sid } }
          )

          // Se retornou 401, tenta reautenticar e refazer a chamada
          if (summaryRes.status === 401) {
            try {
              creds = await login(url, password)
              storedAuth[url] = creds
              localStorage.setItem("piholesAuth", JSON.stringify(storedAuth))
              summaryRes = await fetch(
                `${endpoint}?url=${encodeURIComponent(url)}`,
                { headers: { "X-FTL-SID": creds.sid } }
              )
            } catch {
              throw new Error(`Falha ao obter summary de ${url}`)
            }
          }

          if (!summaryRes.ok) {
            throw new Error(`Falha ao obter summary de ${url}`)
          }

          const data = (await summaryRes.json()) as Summary
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
  }, [router])

  if (loading) return <p>Conectando aos Pi-holes…</p>
  if (error) return <p className="text-red-500">Erro: {error}</p>

  if (!summary) return <p>Nenhum dado carregado.</p>

  return (
    <div className="space-y-8">
      <div className="flex flex-row justify-center gap-4">
        <SummaryCard title="Total" value={summary.queries.total} icon={<FaChartPie className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="Blocked" value={summary.queries.blocked} icon={<FaBan className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="% Blocked" value={summary.queries.percent_blocked} isPercentage icon={<FaPercent className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="Unique Domains" value={summary.queries.unique_domains} icon={<FaGlobe className="w-12 h-12 text-muted-foreground" />} />
      </div>
      <HistoryViewer />
    </div>
  )
}
