import type { ApiBodyOptions, ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { GROUP_BATCH_DELETE_MAX_ITEMS, GROUP_COMMENT_MAX_LENGTH, GROUP_NAME_MAX_LENGTH } from "./dto/group-validation";
import { GROUP_MUTATION_STATUSES } from "./groups.types";

const instanceSourceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
  },
  required: ["instanceId", "instanceName"],
};

const failedInstanceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    kind: { type: "string", enum: [...PIHOLE_REQUEST_ERROR_KINDS] },
    message: { type: "string" },
  },
  required: ["instanceId", "instanceName", "kind", "message"],
};

const groupItemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    comment: { type: "string", nullable: true },
    enabled: { type: "boolean" },
    id: { type: "number" },
    dateAdded: { type: "number", nullable: true },
    dateModified: { type: "number", nullable: true },
    origin: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        instanceName: { type: "string" },
      },
      required: ["instanceId", "instanceName"],
    },
    sync: {
      type: "object",
      properties: {
        isFullySynced: { type: "boolean" },
        sourceInstances: {
          type: "array",
          items: instanceSourceSchema,
        },
        missingInstances: {
          type: "array",
          items: instanceSourceSchema,
        },
      },
      required: ["isFullySynced", "sourceInstances", "missingInstances"],
    },
  },
  required: ["name", "comment", "enabled", "id", "dateAdded", "dateModified", "origin", "sync"],
};

export const GROUPS_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: groupItemSchema,
      },
      source: {
        type: "object",
        properties: {
          baselineInstanceId: { type: "string" },
          baselineInstanceName: { type: "string" },
          totalInstances: { type: "number" },
          availableInstanceCount: { type: "number" },
          unavailableInstanceCount: { type: "number" },
        },
        required: [
          "baselineInstanceId",
          "baselineInstanceName",
          "totalInstances",
          "availableInstanceCount",
          "unavailableInstanceCount",
        ],
      },
      unavailableInstances: {
        type: "array",
        items: failedInstanceSchema,
      },
    },
    required: ["items", "source", "unavailableInstances"],
  },
};

export const GROUPS_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...GROUP_MUTATION_STATUSES] },
      summary: {
        type: "object",
        properties: {
          totalInstances: { type: "number" },
          successfulCount: { type: "number" },
          failedCount: { type: "number" },
        },
        required: ["totalInstances", "successfulCount", "failedCount"],
      },
      successfulInstances: {
        type: "array",
        items: instanceSourceSchema,
      },
      failedInstances: {
        type: "array",
        items: failedInstanceSchema,
      },
    },
    required: ["status", "summary", "successfulInstances", "failedInstances"],
  },
};

export const CREATE_GROUPS_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        example: 'group-one, "My New Group"',
      },
      comment: {
        type: "string",
        maxLength: GROUP_COMMENT_MAX_LENGTH,
        nullable: true,
      },
      enabled: {
        type: "boolean",
        default: true,
      },
    },
    required: ["name"],
  },
};

export const UPDATE_GROUP_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: GROUP_NAME_MAX_LENGTH,
        example: "Analytics Group",
      },
      comment: {
        type: "string",
        maxLength: GROUP_COMMENT_MAX_LENGTH,
        nullable: true,
      },
    },
    required: ["name"],
  },
};

export const UPDATE_GROUP_STATUS_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
      },
    },
    required: ["enabled"],
  },
};

export const BATCH_DELETE_GROUPS_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "string",
          maxLength: GROUP_NAME_MAX_LENGTH,
        },
        maxItems: GROUP_BATCH_DELETE_MAX_ITEMS,
        example: ["test_group", "another_group"],
      },
    },
    required: ["items"],
  },
};

export const SYNC_GROUPS_API_BODY: ApiBodyOptions = {
  required: false,
  schema: {
    type: "object",
    properties: {
      groupName: {
        type: "string",
        minLength: 1,
        maxLength: GROUP_NAME_MAX_LENGTH,
        example: "Analytics Group",
      },
      sourceInstanceId: {
        type: "string",
        example: "clz-source-instance",
      },
      targetInstanceIds: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
        example: ["clz-secondary-a", "clz-secondary-b"],
      },
    },
  },
};
