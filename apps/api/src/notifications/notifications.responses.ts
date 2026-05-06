import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { BACKEND_CONFIG } from "../config/backend-config";
import {
  NOTIFICATION_READ_STATES,
  NOTIFICATION_SOURCES,
  NOTIFICATION_STATES,
  SYSTEM_NOTIFICATION_TYPES,
} from "./notifications.types";

const notificationTypeEnum = [
  ...SYSTEM_NOTIFICATION_TYPES,
  ...BACKEND_CONFIG.notifications.piholeMessageTypes,
] as const;

const notificationItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    source: { type: "string", enum: [...NOTIFICATION_SOURCES] },
    type: { type: "string", enum: [...notificationTypeEnum] },
    title: { type: "string" },
    instanceId: { type: "string", nullable: true },
    instanceName: { type: "string", nullable: true },
    message: { type: "string" },
    metadata: {
      type: "object",
      nullable: true,
      additionalProperties: true,
    },
    state: { type: "string", enum: [...NOTIFICATION_STATES] },
    isRead: { type: "boolean" },
    readAt: { type: "string", format: "date-time", nullable: true },
    hiddenAt: { type: "string", format: "date-time", nullable: true },
    resolvedAt: { type: "string", format: "date-time", nullable: true },
    occurredAt: { type: "string", format: "date-time" },
    lastSeenAt: { type: "string", format: "date-time" },
    occurrenceCount: { type: "number" },
    canDeleteRemotely: { type: "boolean" },
  },
  required: [
    "id",
    "source",
    "type",
    "title",
    "instanceId",
    "instanceName",
    "message",
    "metadata",
    "state",
    "isRead",
    "readAt",
    "hiddenAt",
    "resolvedAt",
    "occurredAt",
    "lastSeenAt",
    "occurrenceCount",
    "canDeleteRemotely",
  ],
};

export const NOTIFICATIONS_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: notificationItemSchema,
      },
      pagination: {
        type: "object",
        properties: {
          page: { type: "number" },
          pageSize: { type: "number" },
          totalItems: { type: "number" },
          totalPages: { type: "number" },
        },
        required: ["page", "pageSize", "totalItems", "totalPages"],
      },
      unreadCount: { type: "number" },
      readState: { type: "string", enum: [...NOTIFICATION_READ_STATES] },
    },
    required: ["items", "pagination", "unreadCount", "readState"],
  },
};

export const NOTIFICATIONS_PREVIEW_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: notificationItemSchema,
      },
      unreadCount: { type: "number" },
      push: {
        type: "object",
        properties: {
          available: { type: "boolean" },
        },
        required: ["available"],
      },
    },
    required: ["items", "unreadCount", "push"],
  },
};

export const NOTIFICATION_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      notification: notificationItemSchema,
    },
    required: ["notification"],
  },
};

export const NOTIFICATION_READ_ALL_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      updatedCount: { type: "number" },
    },
    required: ["updatedCount"],
  },
};

export const PUSH_PUBLIC_KEY_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      available: { type: "boolean" },
      publicKey: { type: "string", nullable: true },
      source: { type: "string", enum: ["env", "database"], nullable: true },
    },
    required: ["available", "publicKey", "source"],
  },
};

export const PUSH_SUBSCRIPTION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean", enum: [true] },
      available: { type: "boolean" },
      endpoint: { type: "string" },
    },
    required: ["ok", "available", "endpoint"],
  },
};
