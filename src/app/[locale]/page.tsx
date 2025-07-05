"use client"

import { useEffect, useState } from "react"

type PiholeConfig = { url: string; password: string }
type AuthData = { sid: string; csrf: string }

export default function ConnectPiholes() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authResults, setAuthResults] = useState<Record<string, AuthData>>({})

  useEffect(() => {
    async function login(url: string, password: string): Promise<AuthData> {
      const authRes = await fetch("/api/piholes/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, password }),
      })
      if (!authRes.ok) {
        const err = await authRes.json().catch(() => null)
        throw new Error(err?.error || `Auth falhou em ${url}`)
      }
      const { sid, csrf } = (await authRes.json()) as AuthData
      return { sid, csrf }
    }

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

    async function authenticateAll() {
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

        const results: Record<string, AuthData> = {}

        for (const { url, password } of piholes) {
          const current = storedAuth[url]
          const auth = await ensureAuth(url, password, current)
          results[url] = auth
        }

        setAuthResults(results)
        localStorage.setItem("piholesAuth", JSON.stringify(results))
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    authenticateAll()
  }, [])

  if (loading) return <p>Conectando aos Pi-holes…</p>
  if (error) return <p className="text-red-500">Erro: {error}</p>

  return (
    <div className="grid gap-4">
      {Object.entries(authResults).map(([url, { sid, csrf }]) => (
        <div key={url} className="p-4 border rounded-lg">
          <h4 className="font-medium">{url}</h4>
          <p>SID: <code>{sid}</code></p>
          <p>CSRF: <code>{csrf}</code></p>
        </div>
      ))}
    </div>
  )
}
