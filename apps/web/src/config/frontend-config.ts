// Central place for frontend defaults and limits that may need quick adjustments.
export const FRONTEND_CONFIG = {
  dashboard: {
    autoRefreshIntervalMs: 5_000,
  },
  queries: {
    pageSizeOptions: [10, 25, 50, 100, 500, 1000] as const,
    defaultPageSize: 10,
    maxPageSize: 1000,
    liveUpdateIntervalMs: 2_000,
  },
  instances: {
    discoveryCandidateLimit: 20,
  },
  sync: {
    blocking: {
      statusRefreshIntervalMs: 20_000,
      countdownTickIntervalMs: 1_000,
    },
  },
} as const;
