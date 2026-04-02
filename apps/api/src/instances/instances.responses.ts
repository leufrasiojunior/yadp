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
