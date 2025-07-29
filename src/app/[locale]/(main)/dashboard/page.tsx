"use client";

import { useEffect } from "react";

import { usePiholeApi } from "@/hooks/use-pihole-api";

interface SummaryData {
  domains_being_blocked: number;
  dns_queries_today: number;
  ads_blocked_today: number;
  ads_percentage_today: number;
  unique_domains: number;
  queries_forwarded: number;
  queries_cached: number;
  clients_ever_seen: number;
  unique_clients: number;
  dns_queries_all_types: number;
  reply_NODATA: number;
  reply_NXDOMAIN: number;
  reply_CNAME: number;
  reply_IP: number;
  privacy_level: number;
  status: string;
  gravity_last_updated: {
    file_exists: boolean;
    absolute: number;
    relative: {
      days: number;
      hours: number;
      minutes: number;
    };
  };
}

export default function Page() {
  const { data, loading, error, refetch } = usePiholeApi<SummaryData>("http://192.168.31.16/admin/api.php?summaryRaw");

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div>
      <h1>Pi-hole Summary</h1>
      <button onClick={() => refetch()}>Refetch Data</button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
