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
  csrfToken: string;
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
