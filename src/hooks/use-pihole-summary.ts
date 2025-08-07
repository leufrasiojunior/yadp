import { useState, useEffect } from "react";

import { PiholeSummary } from "@/types/pihole";

export function usePiholeSummary() {
  const [summary, setSummary] = useState<PiholeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setError(null);
      try {
        const piholesAuth = JSON.parse(localStorage.getItem("piholesAuth") ?? "{}");
        const urls = Object.keys(piholesAuth);
        let totalQueries = 0;
        let totalBlocked = 0;

        for (const url of urls) {
          const sid = piholesAuth[url].sid;
          const response = await fetch(`/api/pihole-proxy?url=${encodeURIComponent(url)}`, {
            headers: {
              "X-FTL-SID": sid,
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Failed to fetch from ${url}: ${errorData.message ?? response.statusText}`);
          }

          const data: PiholeSummary = await response.json();
          totalQueries += data.queries.total;
          totalBlocked += data.queries.blocked;
        }

        setSummary({
          queries: {
            total: totalQueries,
            blocked: totalBlocked,
            percent_blocked: totalQueries > 0 ? (totalBlocked / totalQueries) * 100 : 0,
            unique_domains: 0,
            forwarded: 0,
            cached: 0,
            frequency: 0,
            types: {},
            status: {},
            replies: {},
          },
          clients: { active: 0, total: 0 },
          gravity: { domains_being_blocked: 0, last_update: 0 },
          took: 0,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return { summary, loading, error };
}
