"use client";

import { useEffect, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DASHBOARD_AUTO_REFRESH_INTERVAL_MS } from "@/lib/dashboard/dashboard-refresh";

export function DashboardAutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || isPending) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, DASHBOARD_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [isPending, router]);

  return null;
}
