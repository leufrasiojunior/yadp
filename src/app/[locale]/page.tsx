"use client"

import { useEffect, useState } from "react"

type PiholeConfig = { url: string; password: string }
type AuthData = { sid: string; csrf: string }

export default function ConnectPiholes() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authResults, setAuthResults] = useState<Record<string, AuthData>>({})

  useEffect(() => {
    async function authenticateAll() {
      try {
        // 1) Pega a lista de URL+senha já descriptografadas
        const confRes = await fetch("/api/piholes")
        if (!confRes.ok) throw new Error("Falha ao ler configuração")
        const { piholes } = (await confRes.json()) as { piholes: PiholeConfig[] }

        // 2) Para cada pi-hole, chama sua rota de auth
        const calls = piholes.map(async ({ url, password }) => {
          const authRes = await fetch("/api/piholes/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, password }),
          })
          if (!authRes.ok) {
            const err = await authRes.json()
            throw new Error(err.error || `Auth falhou em ${url}`)
          }
          const { sid, csrf } = (await authRes.json()) as AuthData
          return { url, sid, csrf }
        })

        // 3) Aguarda todas as autenticações
        const results = await Promise.all(calls)

        // 4) Monta objeto chaveado por URL e salva no state + localStorage
        const map: Record<string, AuthData> = {}
        results.forEach(r => { map[r.url] = { sid: r.sid, csrf: r.csrf } })
        setAuthResults(map)
        localStorage.setItem("piholesAuth", JSON.stringify(map))
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
