"use client";

import { useState, useEffect, useCallback } from "react";

// Define a generic aggregator function type
type Aggregator<T, R> = (results: FetchResult<T>[]) => R;

export type FetchResult<T> = {
  url: string;
  data: T;
};

export function useAggregatedPiholeQuery<T, R>(
  endpoint: string,
  aggregator: Aggregator<T, R>,
  initialData: R,
  refreshInterval?: number, // Make refreshInterval optional
) {
  const [data, setData] = useState<R>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [urltoFetch, setUrlToFetch] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // For the first fetch, we are loading. Subsequent fetches are background updates.
    if (loading === false) {
      // Not the initial load, so don't set loading to true
    } else {
      setLoading(true);
    }
    try {
      const piholesAuth = JSON.parse(localStorage.getItem("piholesAuth") ?? "{}");
      const urls = Object.keys(piholesAuth);

      if (urls.length === 0) {
        setLoading(false);
        setData(initialData);
        return;
      }

      const promises = urls.map(async (url) => {
        const sid = piholesAuth[url].sid;
        const response = await fetch(
          `/api/pihole-proxy?url=${encodeURIComponent(url)}&endpoint=${encodeURIComponent(endpoint)}`,
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

        const data = (await response.json()) as T;
        return { url, data } satisfies FetchResult<T>;
      });

      const results = await Promise.all(promises);
      const aggregatedData = aggregator(results);

      setData(aggregatedData);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      // Only set loading to false on the initial fetch
      if (loading) {
        setLoading(false);
      }
    }
  }, [endpoint, aggregator, initialData, loading]);

  useEffect(() => {
    fetchData(); // Initial fetch

    // Only set up the interval if refreshInterval is provided and is a positive number
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchData, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, refreshInterval]);

  return { data, loading, error, urltoFetch };
}
