import { useEffect, useState } from "react";

import { getUnixTime, subHours } from "date-fns";

import { HistoryType } from "@/types/pihole";

export function usePiholeHistory() {
  const [history, setHistory] = useState<{ date: number; total: number; cached: number; blocked: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);

    // 1. Pega a data e hora atual
    const now = new Date();

    // 2. Calcula a data e hora de 24 horas atrás
    const twentyFourHoursAgo = subHours(now, 24);

    // 3. Converte ambas as datas para timestamp Unix (em segundos)
    const from = getUnixTime(twentyFourHoursAgo);
    const until = getUnixTime(now);

    // 4. Monta a URL do endpoint dinamicamente
    const piholeEndpoint = `history/database?from=${from}&until=${until}`;

    console.log(piholeEndpoint);
    // Exemplo de saída: "history/database?from=1721757921&until=1721844321"

    const fetchHistory = async () => {
      try {
        const aggregated: Record<number, { total: number; cached: number; blocked: number }> = {};

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

          const historyData: HistoryType = await response.json();

          for (const item of historyData.history) {
            if (!aggregated[item.timestamp]) {
              aggregated[item.timestamp] = { total: 0, cached: 0, blocked: 0 };
            }

            aggregated[item.timestamp].total += item.total;
            aggregated[item.timestamp].cached += item.cached;
            aggregated[item.timestamp].blocked += item.blocked;
          }
        }

        const chartData = Object.entries(aggregated)
          .map(([timestamp, values]) => ({
            date: Number(timestamp) * 1000, // Convert Unix seconds to JS milliseconds
            total: values.total,
            cached: values.cached,
            blocked: values.blocked,
          }))
          .sort((a, b) => a.date - b.date);
        setHistory(chartData);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return { history, loading, error };
}
