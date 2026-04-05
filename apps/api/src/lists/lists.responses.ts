import type { ApiBodyOptions, ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { LIST_MUTATION_STATUSES } from "./lists.types";

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

const listItemSchema = {
  type: "object",
  properties: {
    address: { type: "string" },
    comment: { type: "string", nullable: true },
    enabled: { type: "boolean" },
    groups: { type: "array", items: { type: "number" } },
    id: { type: "number" },
    dateAdded: { type: "number", nullable: true },
    dateModified: { type: "number", nullable: true },
    type: { type: "string", enum: ["allow", "block"] },
    dateUpdated: { type: "number", nullable: true },
    number: { type: "number", nullable: true },
    invalidDomains: { type: "number", nullable: true },
    abpEntries: { type: "number", nullable: true },
    status: { type: "number", nullable: true },
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
  required: ["address", "comment", "enabled", "groups", "id", "dateAdded", "dateModified", "type", "origin", "sync"],
};

export const LISTS_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: listItemSchema,
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

export const LISTS_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...LIST_MUTATION_STATUSES] },
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

export const UPDATE_LIST_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      comment: { type: "string", nullable: true },
      type: { type: "string", enum: ["allow", "block"] },
      groups: { type: "array", items: { type: "number" } },
      enabled: { type: "boolean" },
    },
    required: ["type", "groups", "enabled"],
  },
};
