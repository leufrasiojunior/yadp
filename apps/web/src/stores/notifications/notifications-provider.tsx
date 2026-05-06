"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { type StoreApi, useStore } from "zustand";

import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type { NotificationsPreviewResponse } from "@/lib/api/yapd-types";

import { createNotificationsStore, type NotificationsState } from "./notifications-store";

const NotificationsStoreContext = createContext<StoreApi<NotificationsState> | null>(null);

function registerNotificationsServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  void navigator.serviceWorker.register("/notifications-sw.js");
}

export function NotificationsProvider({
  children,
  initialPreview,
}: Readonly<{
  children: React.ReactNode;
  initialPreview: NotificationsPreviewResponse | null;
}>) {
  const [store] = useState<StoreApi<NotificationsState>>(() => {
    const client = getAuthenticatedBrowserApiClient();
    let storeApi!: StoreApi<NotificationsState>;

    storeApi = createNotificationsStore({
      preview: initialPreview,
      refreshPreview: async () => {
        const { data, response } = await client.GET<NotificationsPreviewResponse>("/notifications/preview", {
          params: {
            query: {
              limit: FRONTEND_CONFIG.notifications.previewLimit,
            },
          },
        });

        if (!response.ok || !data) {
          return null;
        }

        storeApi.setState({ preview: data });
        return data;
      },
    });

    return storeApi;
  });

  useEffect(() => {
    registerNotificationsServiceWorker();

    const intervalId = window.setInterval(() => {
      void store.getState().refreshPreview();
    }, FRONTEND_CONFIG.notifications.previewRefreshIntervalMs);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "notifications-updated") {
        void store.getState().refreshPreview();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      window.clearInterval(intervalId);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, [store]);

  return <NotificationsStoreContext.Provider value={store}>{children}</NotificationsStoreContext.Provider>;
}

export function useNotificationsStore<T>(selector: (state: NotificationsState) => T): T {
  const store = useContext(NotificationsStoreContext);

  if (!store) {
    throw new Error("Missing NotificationsProvider");
  }

  return useStore(store, selector);
}
