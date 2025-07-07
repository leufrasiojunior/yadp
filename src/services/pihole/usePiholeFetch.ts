// src/lib/usePiholeFetch.ts
"use client";

import { usePiholeAuth } from "@/context/PiholeAuthContext";
import { renewLogin } from "./auth";

export function usePiholeFetch() {
  const { auth, setAuthFor } = usePiholeAuth();

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
    let creds = auth[url];
    if (!creds) {
      throw new Error(`Sem credenciais p/ ${url}`);
    }

    async function doFetch() {
      const headers = new Headers(init.headers);
      headers.set("X-FTL-SID", creds.sid);
      headers.set("Content-Type", "application/json");
      return fetch(endpoint, { ...init, headers });
    }

    let res = await doFetch();
    if (res.status === 401 || res.status === 403) {
      try {
        const fresh = await renewLogin(url);
        setAuthFor(url, fresh);
        creds = fresh;
        res = await doFetch();
      } catch {
        // falha ao renovar, segue com resposta original
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ${res.status}: ${text}`);
    }
    return res.json();
  }

  return { piholeFetch };
}
