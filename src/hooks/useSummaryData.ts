"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { PiholeConfig, Summary } from "@/types/api/summary"
import type { AuthData } from "@/services/pihole/auth"
import { login } from "@/services/pihole/auth"

export function useSummaryData() {
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
          } catch {}
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

  return { summary, loading, error }
}