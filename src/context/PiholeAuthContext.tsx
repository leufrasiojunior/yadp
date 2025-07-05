// src/context/PiholeAuthContext.tsx
"use client"

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react"

type AuthData = { sid: string; csrf: string }
type AuthMap = Record<string, AuthData>

interface ContextValue {
    auth: AuthMap
    setAuthFor: (url: string, data: AuthData) => void
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

    return (
        <PiholeAuthContext.Provider value={{ auth, setAuthFor }}>
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
