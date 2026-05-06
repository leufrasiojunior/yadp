export const BACKEND_CONFIG = {
  notifications: {
    pollIntervalMs: 300_000,
    previewLimit: 5,
    defaultPageSize: 10,
    retentionDays: 30,
    piholeMessageTypes: ["RATE_LIMIT", "CONNECTION_ERROR"] as const,
  },
} as const;

export type SupportedPiholeNotificationType = (typeof BACKEND_CONFIG.notifications.piholeMessageTypes)[number];
