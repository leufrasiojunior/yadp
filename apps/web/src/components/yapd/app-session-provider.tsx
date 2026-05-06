"use client";

import { createContext, useContext, useEffect } from "react";

import { redirectToLogin } from "@/lib/api/yapd-client";

export type AppSession = {
  authenticated: true;
  authMethod: "pihole-master" | "yapd-password";
  baseline: {
    id: string;
    name: string;
    baseUrl: string;
  };
  expiresAt: string;
  timeZone: string;
  csrfToken: string;
  instanceSessions: {
    successfulInstances: Array<{
      instanceId: string;
      instanceName: string;
    }>;
    failedInstances: Array<{
      instanceId: string;
      instanceName: string;
      kind:
        | "invalid_credentials"
        | "tls_error"
        | "timeout"
        | "dns_error"
        | "connection_refused"
        | "pihole_response_error"
        | "unknown";
      message: string;
    }>;
  };
};

const AppSessionContext = createContext<AppSession | null>(null);

export function AppSessionProvider({
  children,
  session,
}: Readonly<{
  children: React.ReactNode;
  session: AppSession;
}>) {
  useEffect(() => {
    const expiresAt = new Date(session.expiresAt).getTime();

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      redirectToLogin();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      redirectToLogin();
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [session.expiresAt]);

  return <AppSessionContext.Provider value={session}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);

  if (!value) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }

  return value;
}
