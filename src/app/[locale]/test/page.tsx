// Exemplo de uso em src/app/[locale]/test/page.tsx
"use client"

import HistoryViewer from "@/components/pages/HistoryViewer/HistoryViewer"



export default function TestPage() {
    const testUrl = "https://192.168.31.16"

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Teste de Histórico</h2>
            <HistoryViewer />
        </div>
    )
}