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

type OverviewNotificationType =
  | "OVERVIEW_IMPORT_SUCCESS"
  | "OVERVIEW_IMPORT_PARTIAL"
  | "OVERVIEW_IMPORT_FAILURE"
  | "OVERVIEW_DELETE_SUCCESS"
  | "OVERVIEW_DELETE_FAILURE";

type OverviewNotificationMetadata = {
  action?: "import" | "delete";
  trigger?: "automatic" | "manual" | string;
  requestedFrom?: string;
  requestedUntil?: string;
  queryCount?: number;
  deletedCount?: number;
  failedCount?: number;
  errorMessage?: string | null;
};

function isOverviewNotificationType(type: NotificationItem["type"]): type is OverviewNotificationType {
  return (
    type === "OVERVIEW_IMPORT_SUCCESS" ||
    type === "OVERVIEW_IMPORT_PARTIAL" ||
    type === "OVERVIEW_IMPORT_FAILURE" ||
    type === "OVERVIEW_DELETE_SUCCESS" ||
    type === "OVERVIEW_DELETE_FAILURE"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseOverviewNotificationMetadata(item: NotificationItem): OverviewNotificationMetadata | null {
  if (!isOverviewNotificationType(item.type) || !isRecord(item.metadata)) {
    return null;
  }

  return {
    action: readString(item.metadata.action) === "delete" ? "delete" : "import",
    trigger: readString(item.metadata.trigger) || undefined,
    requestedFrom: readString(item.metadata.requestedFrom) || undefined,
    requestedUntil: readString(item.metadata.requestedUntil) || undefined,
    queryCount: readNumber(item.metadata.queryCount) ?? undefined,
    deletedCount: readNumber(item.metadata.deletedCount) ?? undefined,
    failedCount: readNumber(item.metadata.failedCount) ?? undefined,
    errorMessage: readString(item.metadata.errorMessage) || null,
  };
}

function getOverviewTriggerLabel(trigger: string | undefined, messages: WebMessages) {
  if (trigger === "automatic") {
    return messages.overview.notifications.triggerAutomatic;
  }

  if (trigger === "manual") {
    return messages.overview.notifications.triggerManual;
  }

  return messages.overview.notifications.triggerUnknown;
}

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
    case "OVERVIEW_IMPORT_SUCCESS":
      return messages.notifications.types.OVERVIEW_IMPORT_SUCCESS;
    case "OVERVIEW_IMPORT_PARTIAL":
      return messages.notifications.types.OVERVIEW_IMPORT_PARTIAL;
    case "OVERVIEW_IMPORT_FAILURE":
      return messages.notifications.types.OVERVIEW_IMPORT_FAILURE;
    case "OVERVIEW_DELETE_SUCCESS":
      return messages.notifications.types.OVERVIEW_DELETE_SUCCESS;
    case "OVERVIEW_DELETE_FAILURE":
      return messages.notifications.types.OVERVIEW_DELETE_FAILURE;
    default:
      return messages.notifications.types.unknown(type);
  }
}

export function getNotificationTitle(item: NotificationItem, messages: WebMessages) {
  if (isOverviewNotificationType(item.type)) {
    return getNotificationTypeLabel(item.type, messages);
  }

  return item.title?.trim().length ? item.title : getNotificationTypeLabel(item.type, messages);
}

export function getNotificationInstanceLabel(item: NotificationItem, messages: WebMessages) {
  return item.instanceName?.trim().length ? item.instanceName : messages.notifications.table.systemInstance;
}

export function getNotificationMessage(
  item: NotificationItem,
  messages: WebMessages,
  formatDateTime: (value: string | Date) => string,
) {
  const metadata = parseOverviewNotificationMetadata(item);

  if (!metadata) {
    return item.message;
  }

  const triggerLabel = getOverviewTriggerLabel(metadata.trigger, messages);
  const requestedFrom = metadata.requestedFrom ? formatDateTime(metadata.requestedFrom) : null;
  const requestedUntil = metadata.requestedUntil ? formatDateTime(metadata.requestedUntil) : null;

  if (!requestedFrom || !requestedUntil) {
    return item.message;
  }

  switch (item.type) {
    case "OVERVIEW_IMPORT_SUCCESS":
      return messages.overview.notifications.importSuccessMessage(
        triggerLabel,
        requestedFrom,
        requestedUntil,
        metadata.queryCount ?? 0,
      );
    case "OVERVIEW_IMPORT_PARTIAL":
      return messages.overview.notifications.importPartialMessage(
        triggerLabel,
        requestedFrom,
        requestedUntil,
        metadata.failedCount ?? 0,
      );
    case "OVERVIEW_IMPORT_FAILURE":
      return messages.overview.notifications.importFailureMessage(
        triggerLabel,
        requestedFrom,
        requestedUntil,
        metadata.errorMessage,
      );
    case "OVERVIEW_DELETE_SUCCESS":
      return messages.overview.notifications.deleteSuccessMessage(
        requestedFrom,
        requestedUntil,
        metadata.deletedCount ?? 0,
      );
    case "OVERVIEW_DELETE_FAILURE":
      return messages.overview.notifications.deleteFailureMessage(requestedFrom, requestedUntil, metadata.errorMessage);
    default:
      return item.message;
  }
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
    case "OVERVIEW_IMPORT_SUCCESS":
      return CircleGauge;
    case "OVERVIEW_IMPORT_PARTIAL":
      return RefreshCwOff;
    case "OVERVIEW_IMPORT_FAILURE":
      return TriangleAlert;
    case "OVERVIEW_DELETE_SUCCESS":
      return List;
    case "OVERVIEW_DELETE_FAILURE":
      return TriangleAlert;
    default:
      return BellDot;
  }
}
