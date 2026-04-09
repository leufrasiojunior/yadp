"use client";

import { createContext, useContext, useState } from "react";

import { type StoreApi, useStore } from "zustand";

import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { NavigationSummaryResponse } from "@/lib/api/yapd-types";

import { createNavigationSummaryStore, type NavigationSummaryState } from "./navigation-summary-store";

const NavigationSummaryStoreContext = createContext<StoreApi<NavigationSummaryState> | null>(null);

export function NavigationSummaryProvider({
  children,
  initialSummary,
}: Readonly<{
  children: React.ReactNode;
  initialSummary: NavigationSummaryResponse | null;
}>) {
  const [store] = useState<StoreApi<NavigationSummaryState>>(() => {
    const client = getBrowserApiClient();
    let storeApi!: StoreApi<NavigationSummaryState>;

    storeApi = createNavigationSummaryStore({
      summary: initialSummary,
      refreshSummary: async () => {
        const { data, response } = await client.GET<NavigationSummaryResponse>("/navigation/summary");

        if (!response.ok || !data) {
          return null;
        }

        storeApi.setState({ summary: data });
        return data;
      },
    });

    return storeApi;
  });

  return <NavigationSummaryStoreContext.Provider value={store}>{children}</NavigationSummaryStoreContext.Provider>;
}

export function useNavigationSummaryStore<T>(selector: (state: NavigationSummaryState) => T): T {
  const store = useContext(NavigationSummaryStoreContext);

  if (!store) {
    throw new Error("Missing NavigationSummaryProvider");
  }

  return useStore(store, selector);
}
