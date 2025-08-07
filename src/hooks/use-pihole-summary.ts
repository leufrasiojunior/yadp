import { useState, useEffect } from "react";

import { PiholeSummary } from "@/types/pihole";

export function usePiholeSummary() {
  const [summary, setSummary] = useState<PiholeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
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
          const data: PiholeSummary = await response.json();
          totalQueries += data.queries.total;
          totalBlocked += data.queries.blocked;
        }

        setSummary({
          queries: {
            total: totalQueries,
            blocked: totalBlocked,
            percent_blocked: (totalBlocked / totalQueries) * 100,
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
      } catch (error) {
        console.error("Error fetching Pi-hole summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return { summary, loading };
}
