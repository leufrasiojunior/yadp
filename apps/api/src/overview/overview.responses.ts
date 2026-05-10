import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import {
  OVERVIEW_FAILURE_KIND_VALUES,
  OVERVIEW_GROUP_BY_VALUES,
  OVERVIEW_JOB_STATUS_VALUES,
  OVERVIEW_SCOPE_VALUES,
} from "./overview.types";

const rankingItemSchema = {
  type: "object",
  properties: {
    value: { type: "string" },
    count: { type: "number" },
  },
  required: ["value", "count"],
};

const chartPointSchema = {
  type: "object",
  properties: {
    timestamp: { type: "string", format: "date-time" },
    totalQueries: { type: "number" },
    blockedQueries: { type: "number" },
    cachedQueries: { type: "number" },
    forwardedQueries: { type: "number" },
    percentageBlocked: { type: "number" },
  },
  required: ["timestamp", "totalQueries", "blockedQueries", "cachedQueries", "forwardedQueries", "percentageBlocked"],
};

const coverageWindowSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    jobId: { type: "string", nullable: true },
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    requestedFrom: { type: "string", format: "date-time" },
    requestedUntil: { type: "string", format: "date-time" },
    storedFrom: { type: "string", format: "date-time", nullable: true },
    storedUntil: { type: "string", format: "date-time", nullable: true },
    rowCount: { type: "number" },
    status: { type: "string", enum: [...OVERVIEW_JOB_STATUS_VALUES] },
    errorMessage: { type: "string", nullable: true },
    expiresAt: { type: "string", format: "date-time" },
    isExpiringSoon: { type: "boolean" },
    expiresInDays: { type: "number" },
  },
  required: [
    "id",
    "jobId",
    "instanceId",
    "instanceName",
    "requestedFrom",
    "requestedUntil",
    "storedFrom",
    "storedUntil",
    "rowCount",
    "status",
    "errorMessage",
    "expiresAt",
    "isExpiringSoon",
    "expiresInDays",
  ],
};

const savedDateSchema = {
  type: "object",
  properties: {
    date: { type: "string", example: "2026-04-28" },
    rowCount: { type: "number" },
    instanceCount: { type: "number" },
    storedFrom: { type: "string", format: "date-time", nullable: true },
    storedUntil: { type: "string", format: "date-time", nullable: true },
  },
  required: ["date", "rowCount", "instanceCount", "storedFrom", "storedUntil"],
};

const instanceSourceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
  },
  required: ["instanceId", "instanceName"],
};

export const OVERVIEW_API_OK_RESPONSE = {
  description: "Historical overview for stored queries.",
  schema: {
    type: "object",
    properties: {
      scope: {
        type: "object",
        properties: {
          mode: { type: "string", enum: [...OVERVIEW_SCOPE_VALUES] },
          instanceId: { type: "string", nullable: true },
          instanceName: { type: "string", nullable: true },
        },
        required: ["mode", "instanceId", "instanceName"],
      },
      filters: {
        type: "object",
        properties: {
          from: { type: "string", format: "date-time" },
          until: { type: "string", format: "date-time" },
          groupBy: { type: "string", enum: [...OVERVIEW_GROUP_BY_VALUES] },
        },
        required: ["from", "until", "groupBy"],
      },
      summary: {
        type: "object",
        properties: {
          totalQueries: { type: "number" },
          blockedQueries: { type: "number" },
          cachedQueries: { type: "number" },
          forwardedQueries: { type: "number" },
          uniqueDomains: { type: "number" },
          uniqueClients: { type: "number" },
          percentageBlocked: { type: "number" },
        },
        required: [
          "totalQueries",
          "blockedQueries",
          "cachedQueries",
          "forwardedQueries",
          "uniqueDomains",
          "uniqueClients",
          "percentageBlocked",
        ],
      },
      charts: {
        type: "object",
        properties: {
          queries: {
            type: "object",
            properties: {
              groupBy: { type: "string", enum: [...OVERVIEW_GROUP_BY_VALUES] },
              points: { type: "array", items: chartPointSchema },
            },
            required: ["groupBy", "points"],
          },
        },
        required: ["queries"],
      },
      rankings: {
        type: "object",
        properties: {
          domains: { type: "array", items: rankingItemSchema },
          clients: { type: "array", items: rankingItemSchema },
          upstreams: { type: "array", items: rankingItemSchema },
          statuses: { type: "array", items: rankingItemSchema },
        },
        required: ["domains", "clients", "upstreams", "statuses"],
      },
      coverage: {
        type: "object",
        properties: {
          hasAnyData: { type: "boolean" },
          requestedFrom: { type: "string", format: "date-time" },
          requestedUntil: { type: "string", format: "date-time" },
          totalStoredQueries: { type: "number" },
          earliestStoredAt: { type: "string", format: "date-time", nullable: true },
          latestStoredAt: { type: "string", format: "date-time", nullable: true },
          savedWindowCount: { type: "number" },
          expiringSoonCount: { type: "number" },
          windows: { type: "array", items: coverageWindowSchema },
          savedWindows: { type: "array", items: coverageWindowSchema },
          savedDates: { type: "array", items: savedDateSchema },
          expiringWindows: { type: "array", items: coverageWindowSchema },
        },
        required: [
          "hasAnyData",
          "requestedFrom",
          "requestedUntil",
          "totalStoredQueries",
          "earliestStoredAt",
          "latestStoredAt",
          "savedWindowCount",
          "expiringSoonCount",
          "windows",
          "savedWindows",
          "savedDates",
          "expiringWindows",
        ],
      },
      sources: {
        type: "object",
        properties: {
          totalInstances: { type: "number" },
          availableInstances: { type: "array", items: instanceSourceSchema },
          failedInstances: {
            type: "array",
            items: {
              type: "object",
              properties: {
                instanceId: { type: "string" },
                instanceName: { type: "string" },
                kind: { type: "string", enum: [...OVERVIEW_FAILURE_KIND_VALUES] },
                message: { type: "string" },
              },
              required: ["instanceId", "instanceName", "kind", "message"],
            },
          },
        },
        required: ["totalInstances", "availableInstances", "failedInstances"],
      },
    },
    required: ["scope", "filters", "summary", "charts", "rankings", "coverage", "sources"],
  },
} satisfies ApiResponseNoStatusOptions;

export const OVERVIEW_JOBS_API_OK_RESPONSE = {
  description: "Recent overview history jobs.",
};

export const OVERVIEW_JOB_DETAILS_API_OK_RESPONSE = {
  description: "Detailed overview history job progress and timeline.",
};

export const OVERVIEW_JOB_MUTATION_API_OK_RESPONSE = {
  description: "Enqueued overview history job.",
};

export const OVERVIEW_COVERAGE_RENEW_API_OK_RESPONSE = {
  description: "Renewed overview coverage retention without refetching data.",
};
