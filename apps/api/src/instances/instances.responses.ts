import type { ApiBodyOptions, ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";

const INSTANCE_TRUST_MODE_VALUES = ["STRICT", "CUSTOM_CA", "ALLOW_SELF_SIGNED"] as const;
const INSTANCE_SESSION_STATUS_VALUES = ["active", "expired", "missing", "error"] as const;
const INSTANCE_SESSION_MANAGED_BY_VALUES = ["human-master", "stored-secret"] as const;

const instanceSummarySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    baseUrl: { type: "string" },
    isBaseline: { type: "boolean" },
    syncEnabled: { type: "boolean" },
    lastKnownVersion: { type: "string", nullable: true },
    lastValidatedAt: { type: "string", format: "date-time", nullable: true },
    trustMode: { type: "string", enum: [...INSTANCE_TRUST_MODE_VALUES] },
    hasCustomCertificate: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    sessionStatus: { type: "string", enum: [...INSTANCE_SESSION_STATUS_VALUES] },
    sessionManagedBy: { type: "string", enum: [...INSTANCE_SESSION_MANAGED_BY_VALUES], nullable: true },
    sessionLoginAt: { type: "string", format: "date-time", nullable: true },
    sessionLastActiveAt: { type: "string", format: "date-time", nullable: true },
    sessionValidUntil: { type: "string", format: "date-time", nullable: true },
    sessionLastErrorKind: { type: "string", enum: [...PIHOLE_REQUEST_ERROR_KINDS], nullable: true },
    sessionLastErrorMessage: { type: "string", nullable: true },
  },
  required: [
    "id",
    "name",
    "baseUrl",
    "isBaseline",
    "syncEnabled",
    "lastKnownVersion",
    "lastValidatedAt",
    "trustMode",
    "hasCustomCertificate",
    "createdAt",
    "updatedAt",
    "sessionStatus",
    "sessionManagedBy",
    "sessionLoginAt",
    "sessionLastActiveAt",
    "sessionValidUntil",
    "sessionLastErrorKind",
    "sessionLastErrorMessage",
  ],
};

const instanceMutationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    baseUrl: { type: "string" },
    version: { type: "string" },
  },
  required: ["id", "name", "baseUrl", "version"],
};

const instanceVersionComponentReleaseSchema = {
  type: "object",
  nullable: true,
  properties: {
    version: { type: "string", nullable: true },
    branch: { type: "string", nullable: true },
    hash: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
  },
  required: ["version", "branch", "hash", "date"],
};

const instanceVersionComponentInfoSchema = {
  type: "object",
  nullable: true,
  properties: {
    local: instanceVersionComponentReleaseSchema,
    remote: instanceVersionComponentReleaseSchema,
  },
  required: ["local", "remote"],
};

const instanceMemoryInfoSchema = {
  type: "object",
  nullable: true,
  properties: {
    total: { type: "number", nullable: true },
    free: { type: "number", nullable: true },
    used: { type: "number", nullable: true },
    available: { type: "number", nullable: true },
    percentUsed: { type: "number", nullable: true },
  },
  required: ["total", "free", "used", "available", "percentUsed"],
};

const instanceWriteProperties = {
  name: {
    type: "string",
    minLength: 2,
    maxLength: 120,
    example: "Pi-hole Sala",
  },
  baseUrl: {
    type: "string",
    format: "uri",
    example: "https://pihole.lan",
  },
  servicePassword: {
    type: "string",
    minLength: 4,
    maxLength: 512,
    example: "service-password",
  },
  allowSelfSigned: {
    type: "boolean",
    default: false,
  },
  certificatePem: {
    type: "string",
    example: "-----BEGIN CERTIFICATE-----",
  },
};

export const INSTANCES_LIST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: instanceSummarySchema,
      },
    },
    required: ["items"],
  },
};

export const INSTANCE_DETAIL_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      instance: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          baseUrl: { type: "string" },
          isBaseline: { type: "boolean" },
          syncEnabled: { type: "boolean" },
          trustMode: { type: "string", enum: [...INSTANCE_TRUST_MODE_VALUES] },
          hasCustomCertificate: { type: "boolean" },
          allowSelfSigned: { type: "boolean" },
          certificatePem: { type: "string", nullable: true },
        },
        required: [
          "id",
          "name",
          "baseUrl",
          "isBaseline",
          "syncEnabled",
          "trustMode",
          "hasCustomCertificate",
          "allowSelfSigned",
          "certificatePem",
        ],
      },
    },
    required: ["instance"],
  },
};

export const INSTANCE_INFO_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      instanceId: { type: "string" },
      fetchedAt: { type: "string", format: "date-time" },
      version: {
        type: "object",
        properties: {
          summary: { type: "string" },
          core: instanceVersionComponentInfoSchema,
          web: instanceVersionComponentInfoSchema,
          ftl: instanceVersionComponentInfoSchema,
          docker: instanceVersionComponentInfoSchema,
        },
        required: ["summary", "core", "web", "ftl", "docker"],
      },
      host: {
        type: "object",
        properties: {
          model: { type: "string", nullable: true },
          nodename: { type: "string", nullable: true },
          machine: { type: "string", nullable: true },
          sysname: { type: "string", nullable: true },
          release: { type: "string", nullable: true },
          version: { type: "string", nullable: true },
          domainname: { type: "string", nullable: true },
        },
        required: ["model", "nodename", "machine", "sysname", "release", "version", "domainname"],
      },
      system: {
        type: "object",
        properties: {
          uptime: { type: "number", nullable: true },
          memory: {
            type: "object",
            properties: {
              ram: instanceMemoryInfoSchema,
              swap: instanceMemoryInfoSchema,
            },
            required: ["ram", "swap"],
          },
          procs: { type: "number", nullable: true },
          cpu: {
            type: "object",
            nullable: true,
            properties: {
              nprocs: { type: "number", nullable: true },
              percentCpu: { type: "number", nullable: true },
              load: {
                type: "object",
                nullable: true,
                properties: {
                  raw: { type: "array", items: { type: "number" }, nullable: true },
                  percent: { type: "array", items: { type: "number" }, nullable: true },
                },
                required: ["raw", "percent"],
              },
            },
            required: ["nprocs", "percentCpu", "load"],
          },
          ftl: {
            type: "object",
            nullable: true,
            properties: {
              percentMem: { type: "number", nullable: true },
              percentCpu: { type: "number", nullable: true },
            },
            required: ["percentMem", "percentCpu"],
          },
        },
        required: ["uptime", "memory", "procs", "cpu", "ftl"],
      },
    },
    required: ["instanceId", "fetchedAt", "version", "host", "system"],
  },
};

export const INSTANCES_DISCOVER_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            baseUrl: { type: "string" },
            reachable: { type: "boolean" },
            authRequired: { type: "boolean" },
            error: { type: "string" },
          },
          required: ["baseUrl", "reachable", "authRequired"],
        },
      },
    },
    required: ["items"],
  },
};

export const INSTANCE_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      instance: instanceMutationSchema,
    },
    required: ["instance"],
  },
};

export const INSTANCE_SYNC_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      instance: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          syncEnabled: { type: "boolean" },
        },
        required: ["id", "name", "syncEnabled"],
      },
    },
    required: ["instance"],
  },
};

export const INSTANCE_PRIMARY_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      instance: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          isBaseline: { type: "boolean" },
          syncEnabled: { type: "boolean" },
        },
        required: ["id", "name", "isBaseline", "syncEnabled"],
      },
      previousBaselineId: { type: "string", nullable: true },
    },
    required: ["instance", "previousBaselineId"],
  },
};

export const INSTANCE_TEST_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      version: { type: "string" },
      checkedAt: { type: "string", format: "date-time" },
    },
    required: ["ok", "version", "checkedAt"],
  },
};

export const INSTANCE_REAUTHENTICATE_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      version: { type: "string" },
      checkedAt: { type: "string", format: "date-time" },
      sessionStatus: { type: "string", enum: [...INSTANCE_SESSION_STATUS_VALUES] },
      sessionLoginAt: { type: "string", format: "date-time", nullable: true },
      sessionLastActiveAt: { type: "string", format: "date-time", nullable: true },
      sessionValidUntil: { type: "string", format: "date-time", nullable: true },
    },
    required: [
      "ok",
      "version",
      "checkedAt",
      "sessionStatus",
      "sessionLoginAt",
      "sessionLastActiveAt",
      "sessionValidUntil",
    ],
  },
};

export const DISCOVER_INSTANCES_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "string",
          format: "uri",
        },
        maxItems: 20,
        example: ["https://pi.hole", "https://pihole.lan"],
      },
    },
  },
};

export const CREATE_INSTANCE_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: instanceWriteProperties,
    required: ["name", "baseUrl", "servicePassword"],
  },
};

export const UPDATE_INSTANCE_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: instanceWriteProperties,
  },
};

export const UPDATE_INSTANCE_SYNC_API_BODY: ApiBodyOptions = {
  schema: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        default: true,
      },
    },
    required: ["enabled"],
  },
};
