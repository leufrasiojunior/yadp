import type { ApiBodyOptions, ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { DOMAIN_OPERATION_KINDS, DOMAIN_OPERATION_TYPES } from "./domains.types";

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

const domainItemSchema = {
  type: "object",
  properties: {
    domain: { type: "string" },
    unicode: { type: "string", nullable: true },
    type: { type: "string", enum: ["allow", "deny"] },
    kind: { type: "string", enum: ["exact", "regex"] },
    comment: { type: "string", nullable: true },
    enabled: { type: "boolean" },
    groups: { type: "array", items: { type: "number" } },
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
  required: ["domain", "type", "kind", "enabled", "groups", "id", "origin", "sync"],
};

export const DOMAIN_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: domainItemSchema,
};

export const DOMAINS_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: domainItemSchema,
      },
      summary: {
        type: "object",
        properties: {
          totalItems: { type: "number" },
          allowTotal: { type: "number" },
          denyTotal: { type: "number" },
          allowExact: { type: "number" },
          allowRegex: { type: "number" },
          denyExact: { type: "number" },
          denyRegex: { type: "number" },
        },
        required: ["totalItems", "allowTotal", "denyTotal", "allowExact", "allowRegex", "denyExact", "denyRegex"],
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
      unavailableInstances: {
        type: "array",
        items: failedInstanceSchema,
      },
    },
    required: ["items", "summary", "pagination", "source", "unavailableInstances"],
  },
};

export const DOMAINS_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["success", "partial"] },
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
          patternMode: { type: "string", nullable: true, enum: ["exact", "regex_specific", "regex_any"] },
          scope: { type: "string" },
          instanceId: { type: "string", nullable: true },
        },
        required: ["type", "kind", "domain", "value", "comment", "patternMode", "scope", "instanceId"],
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
            instanceId: { type: "string" },
            instanceName: { type: "string" },
            took: { type: "number", nullable: true },
          },
          required: ["instanceId", "instanceName", "took"],
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

export const DOMAINS_IMPORT_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        format: "binary",
        description: "CSV file containing domain rows to import.",
      },
    },
    required: ["file"],
  },
};

export const DOMAINS_IMPORT_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["success", "partial"] },
      summary: {
        type: "object",
        properties: {
          totalRows: { type: "number" },
          createdCount: { type: "number" },
          updatedCount: { type: "number" },
          invalidCount: { type: "number" },
        },
        required: ["totalRows", "createdCount", "updatedCount", "invalidCount"],
      },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            line: { type: "number" },
            message: { type: "string" },
          },
          required: ["line", "message"],
        },
      },
    },
    required: ["status", "summary", "errors"],
  },
};
