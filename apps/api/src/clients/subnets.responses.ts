import type { ApiResponseOptions } from "@nestjs/swagger";

const instance = {
  instanceId: { type: "string" as const },
  instanceName: { type: "string" as const },
};
const state = {
  type: "object" as const,
  required: ["groups", "comment"],
  properties: {
    groups: { type: "array" as const, items: { type: "string" as const } },
    comment: { type: "string" as const },
  },
};
const failure = {
  type: "object" as const,
  required: ["instanceId", "instanceName", "message"],
  properties: { ...instance, message: { type: "string" as const } },
};

export const SUBNET_LIST_RESPONSE = {
  schema: {
    type: "object",
    required: ["items", "instances", "unavailableInstances"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["client", "instances"],
          properties: {
            client: { type: "string" },
            instances: {
              type: "array",
              items: {
                type: "object",
                required: ["instanceId", "instanceName", "groups", "comment"],
                properties: { ...instance, ...state.properties },
              },
            },
          },
        },
      },
      instances: {
        type: "array",
        items: { type: "object", required: ["instanceId", "instanceName"], properties: instance },
      },
      unavailableInstances: { type: "array", items: failure },
    },
  },
} satisfies ApiResponseOptions;

export const SUBNET_PLAN_RESPONSE = {
  schema: {
    type: "object",
    required: ["client", "operation", "targets", "previewToken"],
    properties: {
      client: { type: "string" },
      operation: { type: "string", enum: ["save", "delete"] },
      previewToken: { type: "string" },
      targets: {
        type: "array",
        items: {
          type: "object",
          required: ["instanceId", "instanceName", "action", "current", "desired"],
          properties: {
            ...instance,
            action: { type: "string", enum: ["create", "update", "delete", "unchanged", "unavailable"] },
            current: { ...state, nullable: true },
            desired: { ...state, nullable: true },
            message: { type: "string" },
          },
        },
      },
    },
  },
} satisfies ApiResponseOptions;

export const SUBNET_APPLY_RESPONSE = {
  schema: {
    type: "object",
    required: ["status", "successfulInstances", "failedInstances"],
    properties: {
      status: { type: "string", enum: ["success", "partial"] },
      successfulInstances: {
        type: "array",
        items: { type: "object", required: ["instanceId", "instanceName"], properties: instance },
      },
      failedInstances: { type: "array", items: failure },
    },
  },
} satisfies ApiResponseOptions;
