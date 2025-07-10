'use client'
import { useMemo, useState } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip
} from "@/components/ui/chart"
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts"
import { formatUnixTime } from '@/lib/utils'

export interface HistoryEntry {
    timestamp: number
    total: number
    blocked: number
}

interface HistoryChartProps {
    data: HistoryEntry[]
}

const chartConfig = {
    data: { label: "Data", color: "var(--chart-0)" },
    total: { label: "Total", color: "var(--chart-1)" },
    blocked: { label: "Blocked", color: "var(--chart-2)" },
} satisfies ChartConfig

export function HistoryChart({ data }: HistoryChartProps) {
    const [activeChart, setActiveChart] = useState<keyof typeof chartConfig>("total")

    const totals = useMemo(
        () => ({
            total: data.reduce((sum, d) => sum + d.total, 0),
            blocked: data.reduce((sum, d) => sum + d.blocked, 0),
        }),
        [data]
    )

    return (
        <Card className="py-4">
            <CardHeader className="flex flex-col sm:flex-row items-stretch border-b !p-0">
                <div className="flex-1 p-6 flex flex-col justify-center gap-1">
                    <CardTitle>Histórico</CardTitle>
                    <CardDescription>Mostrando o histórico de consultas do Pi-hole.</CardDescription>
                </div>
                <div className="flex w-full sm:w-auto">
                    {(["total", "blocked"] as const).map((key) => (
                        <button
                            key={key}
                            data-active={activeChart === key}
                            className="data-[active=true]:bg-muted/50 flex-1 flex flex-col justify-center gap-1 border-t sm:border-t-0 sm:border-l px-6 py-4 text-left"
                            onClick={() => setActiveChart(key)}
                        >
                            <span className="text-xs text-muted-foreground">
                                {chartConfig[key].label}
                            </span>
                            <span className="text-3xl font-bold">
                                {totals[key].toLocaleString()}
                            </span>
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="px-2 sm:p-6">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={data} margin={{ left: 12, right: 12 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                            minTickGap={20}
                            tickFormatter={(ts) =>
                                new Date(ts * 1000).toLocaleDateString("pt-BR", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }
                        />
                        <YAxis />
                        <ChartTooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {formatUnixTime(label ?? 0, "MMMM d, yyyy")}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: chartConfig[activeChart].color }}
                                                    />
                                                    <span className="text-sm text-muted-foreground">
                                                        {chartConfig[activeChart].label}
                                                    </span>
                                                    <span className="text-sm font-bold text-foreground ml-auto">
                                                        {payload[0].value?.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Bar dataKey={activeChart} fill={chartConfig[activeChart].color} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}