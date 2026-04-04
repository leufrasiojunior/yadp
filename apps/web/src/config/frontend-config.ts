export const FRONTEND_CONFIG = {
  dashboard: {
    autoRefreshIntervalMs: 5_000,
  },
  queries: {
    pageSizeOptions: [10, 25, 50, 100, 500, 1000] as const,
    defaultPageSize: 10,
    maxPageSize: 1000,
    liveUpdateIntervalMs: 5_000,
  },
  clients: {
    searchDebounceMs: 400,
  },
  instances: {
    discoveryCandidateLimit: 20,
  },
  groups: {
    searchDebounceMs: 400,
    deleteConfirmCookieKey: "yapd-groups-skip-delete-confirm",
    deleteConfirmCookieDays: 180,
    nameMaxLength: 255,
    commentMaxLength: 500,
    immutableDefaultGroupId: 0,
  },
  sync: {
    blocking: {
      statusRefreshIntervalMs: 20_000,
      countdownTickIntervalMs: 1_000,
    },
  },
} as const;
