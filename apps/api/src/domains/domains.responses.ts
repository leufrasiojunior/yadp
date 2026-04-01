import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { DOMAIN_OPERATION_KINDS, DOMAIN_OPERATION_TYPES, DOMAIN_SCOPE_VALUES } from "./domains.types";

const instanceSourceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
  },
  required: ["instanceId", "instanceName"],
};

const processedSchema = {
  type: "object",
  properties: {
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string", nullable: true },
          message: { type: "string", nullable: true },
        },
        required: ["item", "message"],
      },
    },
    success: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string", nullable: true },
        },
        required: ["item"],
      },
    },
  },
  required: ["errors", "success"],
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

export const DOMAIN_OPERATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...DOMAIN_OPERATION_TYPES] },
          kind: { type: "string", enum: [...DOMAIN_OPERATION_KINDS] },
          domain: { type: "string" },
          value: { type: "string" },
          comment: { type: "string" },
          scope: { type: "string", enum: [...DOMAIN_SCOPE_VALUES] },
          instanceId: { type: "string", nullable: true },
        },
        required: ["type", "kind", "domain", "value", "comment", "scope", "instanceId"],
      },
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
        items: {
          type: "object",
          properties: {
            ...instanceSourceSchema.properties,
            processed: processedSchema,
            took: { type: "number", nullable: true },
          },
          required: ["instanceId", "instanceName", "processed", "took"],
        },
      },
      failedInstances: {
        type: "array",
        items: failedInstanceSchema,
      },
    },
    required: ["request", "summary", "successfulInstances", "failedInstances"],
  },
};
