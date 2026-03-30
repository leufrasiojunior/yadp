import type { SyncBlockingAggregateStatus, SyncBlockingInstanceStatus } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";

type SyncMessages = WebMessages["sidebar"]["sync"];

export function getSyncBlockingAggregateLabel(messages: SyncMessages, status: SyncBlockingAggregateStatus) {
  switch (status) {
    case "enabled":
      return messages.aggregateEnabled;
    case "disabled":
      return messages.aggregateDisabled;
    case "partial":
      return messages.aggregatePartial;
    default:
      return messages.aggregateMixed;
  }
}

export function getSyncBlockingAggregateBadgeVariant(status: SyncBlockingAggregateStatus) {
  switch (status) {
    case "enabled":
      return "secondary" as const;
    case "partial":
      return "destructive" as const;
    case "disabled":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

export function getSyncBlockingInstanceLabel(messages: SyncMessages, instance: SyncBlockingInstanceStatus) {
  if (!instance.reachable || instance.blocking === null) {
    return messages.instanceUnavailable;
  }

  return instance.blocking === "enabled" ? messages.instanceEnabled : messages.instanceDisabled;
}

export function getSyncBlockingInstanceBadgeVariant(instance: SyncBlockingInstanceStatus) {
  if (!instance.reachable || instance.blocking === null) {
    return "destructive" as const;
  }

  return instance.blocking === "enabled" ? ("secondary" as const) : ("outline" as const);
}
