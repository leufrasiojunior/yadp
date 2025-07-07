"use client"

import { useEffect, useState } from "react"
import { login, AuthData } from "@/services/pihole/auth"
import { SummaryCard } from "@/components/features/summary/SummaryCard"
import type { PiholeConfig, Summary } from "@/types/api/summary"
import { FaChartPie, FaBan, FaPercent, FaGlobe } from "react-icons/fa"

export default function SummaryPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    async function testAuth(url: string, sid: string) {
      try {
        const res = await fetch(
          `/api/piholes/history?url=${encodeURIComponent(url)}`,
          { headers: { "X-FTL-SID": sid } }
        )
        return res.ok
      } catch {
        return false
      }
    }

    async function ensureAuth(
      url: string,
      password: string,
      stored?: AuthData
    ): Promise<AuthData> {
      if (stored && (await testAuth(url, stored.sid))) {
        return stored
      }

      const fresh = await login(url, password)
      if (await testAuth(url, fresh.sid)) {
        return fresh
      }

      throw new Error(`Falha ao autenticar em ${url}`)
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

        const authResults: Record<string, AuthData> = {}
        let total = 0
        let blocked = 0
        let unique = 0

        for (const { url, password } of piholes) {
          const current = storedAuth[url]
          const auth = await ensureAuth(url, password, current)
          authResults[url] = auth

          const summaryRes = await fetch(
            `/api/stats/summary?url=${encodeURIComponent(url)}`,
            { headers: { "X-FTL-SID": auth.sid } }
          )
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
        localStorage.setItem("piholesAuth", JSON.stringify(authResults))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

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
