import React from "react"
import { cn } from "@/lib/utils"
import type { HistoryEntry } from "./HistoryViewer"

interface HistoryBarChartProps {
  history: HistoryEntry[]
  className?: string
}

export default function HistoryBarChart({ history, className }: HistoryBarChartProps) {
  if (!history || history.length === 0) return null

  const maxTotal = Math.max(...history.map(h => h.total))

  return (
    <div className={cn("flex items-end gap-2 h-48", className)}>
      {history.map((entry, idx) => (
        <div key={idx} className="flex flex-col items-center flex-1">
          <div className="flex items-end gap-px h-full">
            <div
              className="w-2 bg-[var(--color-chart-1)]"
              style={{ height: `${(entry.total / maxTotal) * 100}%` }}
            />
            <div
              className="w-2 bg-[var(--color-chart-2)]"
              style={{ height: `${(entry.cached / maxTotal) * 100}%` }}
            />
            <div
              className="w-2 bg-[var(--color-chart-3)]"
              style={{ height: `${(entry.blocked / maxTotal) * 100}%` }}
            />
            <div
              className="w-2 bg-[var(--color-chart-4)]"
              style={{ height: `${(entry.forwarded / maxTotal) * 100}%` }}
            />
          </div>
          <span className="mt-1 text-xs font-mono">
            {new Date(entry.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  )
}
