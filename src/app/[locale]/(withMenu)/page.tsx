"use client"

import { useEffect, useState } from "react"
import { SummaryCard } from "@/components/features/summary/SummaryCard"
import { HistoryChart, type HistoryEntry } from "@/components/features/history/HistoryChart"
import type { PiholeConfig, Summary } from "@/types/api/summary"
import type { AuthData } from "@/services/pihole/auth"
import { login } from "@/services/pihole/auth"
import { FaChartPie, FaBan, FaPercent, FaGlobe } from "react-icons/fa"
import { useRouter } from "next/navigation"

export default function SummaryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

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
        const historyMap: Record<number, HistoryEntry> = {}

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

          const histEndpoint = "/api/piholes/history"
          let histRes = await fetch(
            `${histEndpoint}?url=${encodeURIComponent(url)}`,
            { headers: { "X-FTL-SID": creds.sid } }
          )
          if (histRes.status === 401) {
            try {
              creds = await login(url, password)
              storedAuth[url] = creds
              localStorage.setItem("piholesAuth", JSON.stringify(storedAuth))
              histRes = await fetch(
                `${histEndpoint}?url=${encodeURIComponent(url)}`,
                { headers: { "X-FTL-SID": creds.sid } }
              )
            } catch {
              throw new Error(`Falha ao obter history de ${url}`)
            }
          }
          if (!histRes.ok) {
            throw new Error(`Falha ao obter history de ${url}`)
          }
          const histData = (await histRes.json()) as { history: HistoryEntry[] }
          for (const entry of histData.history) {
            const curr = historyMap[entry.timestamp] || {
              timestamp: entry.timestamp,
              total: 0,
              cached: 0,
              blocked: 0,
              forwarded: 0,
            }
            curr.total += entry.total
            curr.cached += entry.cached
            curr.blocked += entry.blocked
            curr.forwarded += entry.forwarded
            historyMap[entry.timestamp] = curr
          }
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
        const orderedHistory = Object.values(historyMap).sort(
          (a, b) => a.timestamp - b.timestamp
        )
        setHistory(orderedHistory)
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
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-row justify-center gap-4">
        <SummaryCard title="Total" value={summary.queries.total} icon={<FaChartPie className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="Blocked" value={summary.queries.blocked} icon={<FaBan className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="% Blocked" value={summary.queries.percent_blocked} isPercentage icon={<FaPercent className="w-12 h-12 text-muted-foreground" />} />
        <SummaryCard title="Unique Domains" value={summary.queries.unique_domains} icon={<FaGlobe className="w-12 h-12 text-muted-foreground" />} />
      </div>
      <HistoryChart data={history} />
    </div>
  )
}
