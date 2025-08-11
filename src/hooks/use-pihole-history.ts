import { useEffect, useState } from "react";

import { formatUnixTime } from "@/lib/utils";
import { HistoryType } from "@/types/pihole";

export function usePiholeHistory() {
  const [history, setHistory] = useState<{ date: string; total: number; cached: number; blocked: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    const piholeEndpoint = "history/database?from=1754794800&until=1754881199";

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
            date: formatUnixTime(timestamp ?? 0, "MMMM d, yyyy HH:mm"),
            total: values.total,
            cached: values.cached,
            blocked: values.blocked,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        console.log("chartData", chartData);
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
