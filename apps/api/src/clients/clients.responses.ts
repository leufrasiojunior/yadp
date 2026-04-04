import type { ApiBodyOptions, ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { CLIENT_MUTATION_STATUSES, DEFAULT_CLIENTS_PAGE_SIZE, MAX_CLIENTS_PAGE_SIZE } from "./clients.types";

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

const clientItemSchema = {
  type: "object",
  properties: {
    hwaddr: { type: "string" },
    alias: { type: "string", nullable: true },
    macVendor: { type: "string", nullable: true },
    ips: {
      type: "array",
      items: { type: "string" },
    },
    instance: instanceSourceSchema,
    visibleInInstances: {
      type: "array",
      items: instanceSourceSchema,
    },
    instanceDetails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          instanceId: { type: "string" },
          instanceName: { type: "string" },
          ips: {
            type: "array",
            items: { type: "string" },
          },
          firstSeen: { type: "string", format: "date-time", nullable: true },
          lastQuery: { type: "string", format: "date-time", nullable: true },
          numQueries: { type: "number" },
        },
        required: ["instanceId", "instanceName", "ips", "firstSeen", "lastQuery", "numQueries"],
      },
    },
    firstSeen: { type: "string", format: "date-time", nullable: true },
    lastQuery: { type: "string", format: "date-time", nullable: true },
    numQueries: { type: "number" },
    comment: { type: "string", nullable: true },
    groupIds: {
      type: "array",
      items: { type: "number" },
    },
    groupNames: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "hwaddr",
    "alias",
    "macVendor",
    "ips",
    "instance",
    "visibleInInstances",
    "instanceDetails",
    "firstSeen",
    "lastQuery",
    "numQueries",
    "comment",
    "groupIds",
    "groupNames",
  ],
};

export const CLIENTS_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: clientItemSchema,
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
    required: ["items", "pagination", "source", "unavailableInstances"],
  },
};

export const CLIENTS_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...CLIENT_MUTATION_STATUSES] },
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

export const SAVE_CLIENTS_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      client: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
        example: ["82:6D:06:2E:9D:DC"],
      },
      comment: {
        type: "string",
        nullable: true,
        example: "",
      },
      alias: {
        type: "string",
        nullable: true,
        example: "Notebook Sala",
      },
      groups: {
        type: "array",
        items: {
          type: "number",
        },
        minItems: 1,
        example: [3],
      },
      targetInstanceIds: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
        example: ["clz-secondary-a"],
      },
    },
    required: ["client"],
  },
};

export const SYNC_CLIENTS_API_BODY: ApiBodyOptions = {
  required: false,
  schema: {
    type: "object",
    properties: {
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

export const CLIENTS_QUERY_PARAMETERS: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      page: {
        type: "number",
        default: 1,
      },
      pageSize: {
        type: "number",
        default: DEFAULT_CLIENTS_PAGE_SIZE,
        maximum: MAX_CLIENTS_PAGE_SIZE,
      },
    },
  },
};
