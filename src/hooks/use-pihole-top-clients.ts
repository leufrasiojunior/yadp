import { useEffect, useState } from "react";

import { ChartTopClientesHistoryType } from "@/types/pihole";

export function usePiholeTopClients() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartConfig, setChartConfig] = useState<any>({});
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchTopClients = async () => {
      try {
        setError(null);

        const piholeEndpoint = "history/clients";
        const piholesAuth = JSON.parse(localStorage.getItem("piholesAuth") ?? "{}");
        const urls = Object.keys(piholesAuth);

        for (const url of urls) {
          const sid = piholesAuth[url].sid;

          const response = await fetch(
            `/api/pihole-proxy?url=${encodeURIComponent(url)}&endpoint=${encodeURIComponent(piholeEndpoint)}`,
            {
              headers: {
                "X-FTL-SID": sid,
              },
            },
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Failed to fetch from ${url}: ${errorData.message ?? response.statusText}`);
          }

          const data: ChartTopClientesHistoryType = await response.json();

          // 🔑 Filtra apenas clientes com valores > 0
          const activeKeys = Object.keys(data.clients).filter((key) =>
            data.history.some((entry) => (entry.data[key] ?? 0) > 0),
          );

          // 🚫 Substitui "." por "_" para evitar problemas no Recharts
          const safeKeyMap = Object.fromEntries(activeKeys.map((k) => [k, k.replace(/\./g, "_")]));

          // 📊 Prepara chartData no formato esperado pelo gráfico
          const chartData = data.history.map((entry) => {
            const row: Record<string, number | string> = { date: Number(entry.timestamp) * 1000 };
            for (const k of activeKeys) {
              row[safeKeyMap[k]] = entry.data[k] ?? 0;
            }
            return row;
          });

          // 🎨 Configuração dinâmica do gráfico
          const chartConfig = Object.fromEntries(
            activeKeys.map((k, idx) => [
              safeKeyMap[k],
              {
                label: data.clients[k]?.name ?? k,
                color: `var(--chart-${(idx % 12) + 1})`,
              },
            ]),
          );

          // ✅ Atualiza os estados prontos para uso
          setChartData(chartData);
          setChartConfig(chartConfig);
          setActiveKeys(activeKeys);
        }
      } catch (err: any) {
        setError(err);
        if (intervalId) clearInterval(intervalId);
      } finally {
        setLoading(false);
      }
    };

    fetchTopClients();
    intervalId = setInterval(fetchTopClients, 10000);

    return () => clearInterval(intervalId);
  }, []);

  return { chartData, chartConfig, activeKeys, loading, error };
}
