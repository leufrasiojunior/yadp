import type { InstanceItem } from "@/lib/api/yapd-types";

export const DASHBOARD_SCOPE_COOKIE = "dashboard_scope";

export type DashboardScope =
  | {
      kind: "all";
    }
  | {
      kind: "instance";
      instanceId: string;
    };

export function parseDashboardScope(value?: string | null): DashboardScope {
  if (value?.startsWith("instance:")) {
    const instanceId = value.slice("instance:".length).trim();

    if (instanceId.length > 0) {
      return {
        kind: "instance",
        instanceId,
      };
    }
  }

  return {
    kind: "all",
  };
}

export function serializeDashboardScope(scope: DashboardScope) {
  return scope.kind === "all" ? "all" : `instance:${scope.instanceId}`;
}

export function resolveDashboardScope(scope: DashboardScope, instances: InstanceItem[]): DashboardScope {
  if (scope.kind === "instance" && instances.some((instance) => instance.id === scope.instanceId)) {
    return scope;
  }

  return {
    kind: "all",
  };
}
