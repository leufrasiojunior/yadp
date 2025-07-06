// src/lib/usePiholeFetch.ts
"use client";

import { usePiholeAuth } from "@/context/PiholeAuthContext";

export function usePiholeFetch() {
  const { auth } = usePiholeAuth();

  /**
   * Faz fetch a um endpoint de sua API, adicionando
   * o header X-FTL-SID correspondente à URL informada.
   *
   * @param endpoint rota da sua API, ex: "/api/history"
   * @param url       url do Pi-hole p/ buscar o sid
   * @param init      resto das opções de fetch
   */
  async function piholeFetch(
    endpoint: string,
    url: string,
    init: RequestInit = {}
  ) {
    const creds = auth[url];
    if (!creds) {
      throw new Error(`Sem credenciais p/ ${url}`);
    }

    const headers = new Headers(init.headers);
    headers.set("X-FTL-SID", creds.sid);
    headers.set("Content-Type", "application/json");

    const res = await fetch(endpoint, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ${res.status}: ${text}`);
    }
    return res.json();
  }

  return { piholeFetch };
}
