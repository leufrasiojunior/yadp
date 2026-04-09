import { createStore } from "zustand/vanilla";

import type { NavigationSummaryResponse } from "@/lib/api/yapd-types";

export type NavigationSummaryState = {
  summary: NavigationSummaryResponse | null;
  setSummary: (summary: NavigationSummaryResponse | null) => void;
  refreshSummary: () => Promise<NavigationSummaryResponse | null>;
};

export const createNavigationSummaryStore = (init?: {
  summary?: NavigationSummaryResponse | null;
  refreshSummary?: () => Promise<NavigationSummaryResponse | null>;
}) =>
  createStore<NavigationSummaryState>()((set) => ({
    summary: init?.summary ?? null,
    setSummary: (summary) => set({ summary }),
    refreshSummary: init?.refreshSummary ?? (async () => null),
  }));
