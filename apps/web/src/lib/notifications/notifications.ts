import type { LucideIcon } from "lucide-react";
import {
  BellDot,
  CircleGauge,
  Globe,
  KeyRound,
  List,
  RefreshCwOff,
  ServerCrash,
  TriangleAlert,
  Users,
  WifiOff,
} from "lucide-react";

import type { NotificationItem } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";

export function getNotificationTypeLabel(type: NotificationItem["type"], messages: WebMessages) {
  switch (type) {
    case "RATE_LIMIT":
      return messages.notifications.types.RATE_LIMIT;
    case "CONNECTION_ERROR":
      return messages.notifications.types.CONNECTION_ERROR;
    case "CLIENTS_FAILURE":
      return messages.notifications.types.CLIENTS_FAILURE;
    case "DOMAINS_FAILURE":
      return messages.notifications.types.DOMAINS_FAILURE;
    case "GROUPS_FAILURE":
      return messages.notifications.types.GROUPS_FAILURE;
    case "INSTANCES_FAILURE":
      return messages.notifications.types.INSTANCES_FAILURE;
    case "LISTS_FAILURE":
      return messages.notifications.types.LISTS_FAILURE;
    case "NOTIFICATION_SYNC_ERROR":
      return messages.notifications.types.NOTIFICATION_SYNC_ERROR;
    case "INSTANCE_SESSION_ERROR":
      return messages.notifications.types.INSTANCE_SESSION_ERROR;
    case "SYNC_FAILURE":
      return messages.notifications.types.SYNC_FAILURE;
    case "SYSTEM_FAILURE":
      return messages.notifications.types.SYSTEM_FAILURE;
    default:
      return messages.notifications.types.unknown(type);
  }
}

export function getNotificationInstanceLabel(item: NotificationItem, messages: WebMessages) {
  return item.instanceName?.trim().length ? item.instanceName : messages.notifications.table.systemInstance;
}

export function getNotificationTypeIcon(type: NotificationItem["type"]): LucideIcon {
  switch (type) {
    case "RATE_LIMIT":
      return CircleGauge;
    case "CONNECTION_ERROR":
      return WifiOff;
    case "CLIENTS_FAILURE":
      return Users;
    case "DOMAINS_FAILURE":
      return Globe;
    case "GROUPS_FAILURE":
      return Users;
    case "INSTANCES_FAILURE":
      return ServerCrash;
    case "LISTS_FAILURE":
      return List;
    case "NOTIFICATION_SYNC_ERROR":
      return RefreshCwOff;
    case "INSTANCE_SESSION_ERROR":
      return KeyRound;
    case "SYNC_FAILURE":
      return RefreshCwOff;
    case "SYSTEM_FAILURE":
      return TriangleAlert;
    default:
      return BellDot;
  }
}
