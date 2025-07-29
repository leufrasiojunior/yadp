"use client";

import { useState, useCallback } from "react";

import { useRouter } from "next/navigation";

import { useLocale } from "next-intl";

interface AuthData {
  sid: string;
  csrf: string;
}

interface PiholeApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function usePiholeApi<T>(apiUrl: string) {
  const [apiState, setApiState] = useState<PiholeApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const router = useRouter();
  const locale = useLocale();

  const getAuthData = useCallback((): AuthData | null => {
    const authStorage = localStorage.getItem("piholesAuth");
    if (!authStorage) return null;

    try {
      const authData = JSON.parse(authStorage);
      const baseUrl = new URL(apiUrl).origin;
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing, security/detect-object-injection
      return authData[baseUrl] || null;
    } catch (error) {
      console.error("Failed to parse auth data from localStorage", error);
      return null;
    }
  }, [apiUrl]);

  const fetchApi = useCallback(async () => {
    setApiState({ data: null, loading: true, error: null });

    const auth = getAuthData();
    if (!auth) {
      router.push(`/${locale}/login`);
      return;
    }

    try {
      const response = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-Pihole-SID": auth.sid,
          "X-Pihole-CSRF": auth.csrf,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("yapdAuthTime");
        localStorage.removeItem("piholesAuth");
        router.push(`/${locale}/login`);
        return;
      }

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = (await response.json()) as T;
      setApiState({ data, loading: false, error: null });
    } catch (error) {
      setApiState({ data: null, loading: false, error: error as Error });
    }
  }, [apiUrl, getAuthData, router, locale]);

  return { ...apiState, refetch: fetchApi };
}
