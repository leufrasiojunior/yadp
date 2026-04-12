import { createStore } from "zustand/vanilla";

import type { NotificationsPreviewResponse } from "@/lib/api/yapd-types";

export type NotificationsState = {
  preview: NotificationsPreviewResponse | null;
  setPreview: (preview: NotificationsPreviewResponse | null) => void;
  refreshPreview: () => Promise<NotificationsPreviewResponse | null>;
};

export const createNotificationsStore = (init?: {
  preview?: NotificationsPreviewResponse | null;
  refreshPreview?: () => Promise<NotificationsPreviewResponse | null>;
}) =>
  createStore<NotificationsState>()((set) => ({
    preview: init?.preview ?? null,
    setPreview: (preview) => set({ preview }),
    refreshPreview: init?.refreshPreview ?? (async () => null),
  }));
