// src/context/PiholeAuthContext.tsx
"use client"

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react"
import { login } from "@/services/pihole/auth"

type AuthData = { sid: string; csrf: string }
type AuthMap = Record<string, AuthData>

interface ContextValue {
    auth: AuthMap
    setAuthFor: (url: string, data: AuthData) => void
    renewAuthFor: (url: string) => Promise<AuthData>
}

const PiholeAuthContext = createContext<ContextValue | undefined>(undefined)

export function PiholeAuthProvider({ children }: { children: ReactNode }) {
    const [auth, setAuth] = useState<AuthMap>({})

    // Ao montar, carrega do localStorage
    useEffect(() => {
        const stored = localStorage.getItem("piholesAuth")
        if (stored) {
            try {
                setAuth(JSON.parse(stored))
            } catch { }
        }
    }, [])

    // Atualiza no state e no localStorage
    function setAuthFor(url: string, data: AuthData) {
        setAuth((prev) => {
            const next = { ...prev, [url]: data }
            localStorage.setItem("piholesAuth", JSON.stringify(next))
            return next
        })
    }

    async function renewAuthFor(url: string): Promise<AuthData> {
        const confRes = await fetch("/api/piholes")
        if (!confRes.ok) {
            throw new Error("Falha ao carregar configuração")
        }
        const { piholes } = (await confRes.json()) as {
            piholes: { url: string; password: string }[]
        }
        const entry = piholes.find((p) => p.url === url)
        if (!entry) {
            throw new Error(`URL ${url} não encontrada na configuração`)
        }
        const newAuth = await login(url, entry.password)
        setAuthFor(url, newAuth)
        return newAuth
    }

    return (
        <PiholeAuthContext.Provider value={{ auth, setAuthFor, renewAuthFor }}>
            {children}
        </PiholeAuthContext.Provider>
    )
}

export function usePiholeAuth() {
    const ctx = useContext(PiholeAuthContext)
    if (!ctx) {
        throw new Error("usePiholeAuth deve ser usado dentro de PiholeAuthProvider")
    }
    return ctx
}
