"use client"

import { useEffect, useState } from "react"
import { login, AuthData } from "@/lib/piholeLogin"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

type PiholeConfig = { url: string; password: string }

type Summary = {
  queries: {
    total: number
    blocked: number
    percent_blocked: number
    unique_domains: number
  }
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<Record<string, Summary>>({})

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
          } catch {}
        }

        const authResults: Record<string, AuthData> = {}
        const results: Record<string, Summary> = {}

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
          results[url] = (await summaryRes.json()) as Summary
        }

        setSummaries(results)
        localStorage.setItem("piholesAuth", JSON.stringify(authResults))
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

  if (loading) return <p>Conectando aos Pi-holes…</p>
  if (error) return <p className="text-red-500">Erro: {error}</p>

  return (
    <div className="space-y-6 p-4">
      {Object.entries(summaries).map(([url, summary]) => (
        <div key={url} className="space-y-4">
          <h4 className="font-medium">{url}</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Total</CardTitle>
              </CardHeader>
              <CardContent>{summary.queries.total}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Blocked</CardTitle>
              </CardHeader>
              <CardContent>{summary.queries.blocked}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>% Blocked</CardTitle>
              </CardHeader>
              <CardContent>{summary.queries.percent_blocked}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Unique Domains</CardTitle>
              </CardHeader>
              <CardContent>{summary.queries.unique_domains}</CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  )
}
