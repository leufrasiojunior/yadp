"use client";

import { createContext, useContext } from "react";

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
  return <AppSessionContext.Provider value={session}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);

  if (!value) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }

  return value;
}
