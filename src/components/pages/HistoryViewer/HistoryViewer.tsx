// src/components/HistoryViewer.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { usePiholeAuth } from "@/context/PiholeAuthContext"

export type HistoryEntry = {
    timestamp: number
    total: number
    cached: number
    blocked: number
    forwarded: number
}

export default function HistoryViewer() {
    const { auth } = usePiholeAuth()
    const urls = Object.keys(auth)
    const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({})
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    // Ref para garantir que rodamos apenas uma vez quando URLs estiverem disponíveis
    const hasLoadedRef = useRef(false)

    useEffect(() => {
        // Se já carregou ou não há URLs, não faz nada
        if (hasLoadedRef.current || urls.length === 0) {
            if (urls.length === 0) setLoading(false)
            return
        }

        async function loadAllHistories() {
            setLoading(true)
            setError(null)

            try {
                const results: Record<string, HistoryEntry[]> = {}

                await Promise.all(
                    urls.map(async (url) => {
                        const sid = auth[url].sid
                        const res = await fetch(
                            `/api/piholes/history?url=${encodeURIComponent(url)}`,
                            {
                                method: "GET",
                                headers: { "X-FTL-SID": sid },
                            }
                        )
                        if (!res.ok) {
                            throw new Error(`Erro ao buscar histórico de ${url}: ${res.status}`)
                        }
                        const data = (await res.json()) as { history: HistoryEntry[] }
                        results[url] = data.history
                    })
                )

                setHistories(results)
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erro desconhecido'
                setError(message)
            } finally {
                setLoading(false)
                hasLoadedRef.current = true
            }
        }

        loadAllHistories()
    }, [urls, auth])

    if (loading) return <p>Carregando históricos…</p>
    if (error) return <p className="text-red-500">Erro: {error}</p>
    if (Object.keys(histories).length === 0) {
        return <p>Nenhum histórico carregado.</p>
    }

    return (
        <div className="space-y-6 p-4">
            {Object.entries(histories).map(([url, history]) => (
                <div key={url} className="border rounded-lg p-4">
                    <h4 className="text-lg font-medium">Histórico de {url}</h4>
                    <ul className="list-disc ml-5">
                        {history.map((entry, idx) => (
                            <li key={idx}>
                                <time className="font-mono">
                                    {new Date(entry.timestamp * 1000).toLocaleString()}
                                </time>
                                : total {entry.total}, cached {entry.cached}, blocked {entry.blocked}, forwarded {entry.forwarded}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}
