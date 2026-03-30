import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import {
  SYNC_BLOCKING_AGGREGATE_STATUSES,
  SYNC_BLOCKING_APPLY_RESULT_STATUSES,
  SYNC_OPERATION_KEYS,
} from "./sync.types";

const blockingStateSchema = {
  type: "string",
  enum: ["enabled", "disabled"],
};

const blockingAggregateSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: [...SYNC_BLOCKING_AGGREGATE_STATUSES],
    },
    timerSeconds: {
      type: "number",
      nullable: true,
    },
  },
  required: ["status", "timerSeconds"],
};

const blockingInstanceStatusSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    instanceAddress: { type: "string" },
    blocking: {
      ...blockingStateSchema,
      nullable: true,
    },
    timerSeconds: { type: "number", nullable: true },
    reachable: { type: "boolean" },
    message: { type: "string", nullable: true },
  },
  required: ["instanceId", "instanceName", "instanceAddress", "blocking", "timerSeconds", "reachable"],
};

const blockingPreviewInstanceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    blocking: blockingStateSchema,
    timerSeconds: { type: "number", nullable: true },
  },
  required: ["instanceId", "instanceName", "blocking", "timerSeconds"],
};

const blockingPresetSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    timerSeconds: { type: "number" },
    sortOrder: { type: "number" },
  },
  required: ["id", "name", "timerSeconds", "sortOrder"],
};

const blockingFailureSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    kind: {
      type: "string",
      enum: [...PIHOLE_REQUEST_ERROR_KINDS],
    },
    message: { type: "string" },
  },
  required: ["instanceId", "instanceName", "kind", "message"],
};

export const SYNC_BLOCKING_STATUS_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      aggregate: blockingAggregateSchema,
      instances: {
        type: "array",
        items: blockingInstanceStatusSchema,
      },
      presets: {
        type: "array",
        items: blockingPresetSchema,
      },
    },
    required: ["aggregate", "instances", "presets"],
  },
};

export const SYNC_BLOCKING_PRESET_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      presets: {
        type: "array",
        items: blockingPresetSchema,
      },
    },
    required: ["presets"],
  },
};

export const SYNC_BLOCKING_PREVIEW_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      desiredConfig: {
        type: "object",
        properties: {
          blocking: { type: "boolean" },
          timerSeconds: { type: "number", nullable: true },
        },
        required: ["blocking", "timerSeconds"],
      },
      aggregate: blockingAggregateSchema,
      readyInstances: {
        type: "array",
        items: blockingPreviewInstanceSchema,
      },
      noopInstances: {
        type: "array",
        items: blockingPreviewInstanceSchema,
      },
      failedInstances: {
        type: "array",
        items: blockingFailureSchema,
      },
    },
    required: ["desiredConfig", "aggregate", "readyInstances", "noopInstances", "failedInstances"],
  },
};

export const SYNC_BLOCKING_APPLY_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      job: {
        type: "object",
        properties: {
          id: { type: "string" },
          operationKey: {
            type: "string",
            enum: [...SYNC_OPERATION_KEYS],
          },
          status: {
            type: "string",
            enum: ["SUCCESS", "PARTIAL", "FAILURE"],
          },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time", nullable: true },
        },
        required: ["id", "operationKey", "status", "startedAt", "finishedAt"],
      },
      summary: {
        type: "object",
        properties: {
          successfulCount: { type: "number" },
          failedCount: { type: "number" },
          noopCount: { type: "number" },
          skippedCount: { type: "number" },
          totalInstances: { type: "number" },
        },
        required: ["successfulCount", "failedCount", "noopCount", "skippedCount", "totalInstances"],
      },
      instances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            instanceId: { type: "string" },
            instanceName: { type: "string" },
            status: {
              type: "string",
              enum: [...SYNC_BLOCKING_APPLY_RESULT_STATUSES],
            },
            message: { type: "string", nullable: true },
            blocking: {
              ...blockingStateSchema,
              nullable: true,
            },
            timerSeconds: { type: "number", nullable: true },
          },
          required: ["instanceId", "instanceName", "status", "message", "blocking", "timerSeconds"],
        },
      },
    },
    required: ["job", "summary", "instances"],
  },
};
