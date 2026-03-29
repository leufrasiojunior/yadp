"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";

import type { DashboardOverviewResponse } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";

const DASHBOARD_FAILURE_FINGERPRINT_STORAGE_KEY = "yapd.dashboard.failedInstancesFingerprint";

export function DashboardOverviewToasts({
  failedInstances,
}: Readonly<{
  failedInstances: DashboardOverviewResponse["sources"]["failedInstances"];
}>) {
  const fingerprintRef = useRef<string | null>(null);
  const { messages } = useWebI18n();

  useEffect(() => {
    if (failedInstances.length === 0) {
      fingerprintRef.current = null;
      window.sessionStorage.removeItem(DASHBOARD_FAILURE_FINGERPRINT_STORAGE_KEY);
      return;
    }

    const fingerprint = failedInstances
      .map((item) => `${item.instanceId}:${item.kind}:${item.message}`)
      .sort()
      .join("|");
    const storedFingerprint = window.sessionStorage.getItem(DASHBOARD_FAILURE_FINGERPRINT_STORAGE_KEY);

    if (fingerprintRef.current === fingerprint || storedFingerprint === fingerprint) {
      return;
    }

    fingerprintRef.current = fingerprint;
    window.sessionStorage.setItem(DASHBOARD_FAILURE_FINGERPRINT_STORAGE_KEY, fingerprint);

    failedInstances.forEach((failure) => {
      const message =
        failure.message.trim().length > 0
          ? messages.dashboard.toasts.instanceFailure(failure.instanceName, failure.message)
          : messages.dashboard.toasts.genericInstanceFailure(failure.instanceName);

      toast.error(message, {
        id: `dashboard-instance-failure-${failure.instanceId}`,
      });
    });
  }, [failedInstances, messages.dashboard.toasts]);

  return null;
}
