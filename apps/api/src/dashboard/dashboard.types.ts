import type {
  PiholeClientActivitySeries,
  PiholeHistoryPoint,
  PiholeManagedInstanceSummary,
  PiholeMetricsSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";

export const DASHBOARD_OVERVIEW_SCOPE_VALUES = ["all", "instance"] as const;

export type DashboardOverviewScopeMode = (typeof DASHBOARD_OVERVIEW_SCOPE_VALUES)[number];

export type DashboardInstanceSourceSummary = {
  instanceId: string;
  instanceName: string;
};

export type DashboardInstanceFailure = DashboardInstanceSourceSummary & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type DashboardInstanceMetricsSource = {
  instance: PiholeManagedInstanceSummary;
  summary: PiholeMetricsSummary;
  totalQueries: PiholeHistoryPoint[];
  clientActivity: PiholeClientActivitySeries[];
};

export type DashboardOverviewResponse = {
  scope: {
    mode: DashboardOverviewScopeMode;
    instanceId: string | null;
    instanceName: string | null;
  };
  summary: PiholeMetricsSummary;
  charts: {
    totalQueries: {
      points: Array<{
        timestamp: string;
        totalQueries: number;
        cachedQueries: number;
        blockedQueries: number;
        forwardedQueries: number;
        percentageBlocked: number;
      }>;
    };
    clientActivity: {
      series: Array<{
        key: string;
        label: string;
        totalQueries: number;
        points: Array<{
          timestamp: string;
          queries: number;
        }>;
      }>;
    };
  };
  sources: {
    totalInstances: number;
    successfulInstances: DashboardInstanceSourceSummary[];
    failedInstances: DashboardInstanceFailure[];
  };
};
