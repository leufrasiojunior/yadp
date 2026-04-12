import type { BACKEND_CONFIG } from "../config/backend-config";

export const NOTIFICATION_SOURCES = ["PIHOLE", "SYSTEM"] as const;
export const NOTIFICATION_STATES = ["ACTIVE", "RESOLVED"] as const;
export const NOTIFICATION_READ_STATES = ["unread", "read"] as const;
export const SYSTEM_NOTIFICATION_TYPES = [
  "CLIENTS_FAILURE",
  "DOMAINS_FAILURE",
  "GROUPS_FAILURE",
  "INSTANCES_FAILURE",
  "LISTS_FAILURE",
  "NOTIFICATION_SYNC_ERROR",
  "INSTANCE_SESSION_ERROR",
  "SYNC_FAILURE",
  "SYSTEM_FAILURE",
] as const;

export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];
export type NotificationState = (typeof NOTIFICATION_STATES)[number];
export type NotificationReadState = (typeof NOTIFICATION_READ_STATES)[number];
export type SystemNotificationType = (typeof SYSTEM_NOTIFICATION_TYPES)[number];
export type SupportedPiholeNotificationType = (typeof BACKEND_CONFIG.notifications.piholeMessageTypes)[number];

export type NotificationType = SystemNotificationType | SupportedPiholeNotificationType | string;

export type NotificationItem = {
  id: string;
  source: NotificationSource;
  type: NotificationType;
  instanceId: string | null;
  instanceName: string | null;
  message: string;
  state: NotificationState;
  isRead: boolean;
  readAt: string | null;
  hiddenAt: string | null;
  resolvedAt: string | null;
  occurredAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  canDeleteRemotely: boolean;
};

export type NotificationsListResponse = {
  items: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  unreadCount: number;
  readState: NotificationReadState;
};

export type NotificationsPreviewResponse = {
  items: NotificationItem[];
  unreadCount: number;
  push: {
    available: boolean;
  };
};

export type NotificationMutationResponse = {
  notification: NotificationItem;
};

export type NotificationReadAllResponse = {
  updatedCount: number;
};

export type PushPublicKeyResponse = {
  available: boolean;
  publicKey: string | null;
};

export type PushSubscriptionResponse = {
  ok: true;
  available: boolean;
  endpoint: string;
};
