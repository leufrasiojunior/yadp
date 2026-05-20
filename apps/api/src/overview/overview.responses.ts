import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import {
  OVERVIEW_AUTOMATIC_IMPORT_RUN_STATUS_VALUES,
  OVERVIEW_FAILURE_KIND_VALUES,
  OVERVIEW_GROUP_BY_VALUES,
  OVERVIEW_JOB_FAILURE_REASON_VALUES,
  OVERVIEW_JOB_KIND_VALUES,
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

const automaticImportRuleSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    enabled: { type: "boolean" },
    cronExpression: { type: "string" },
    scope: { type: "string", enum: [...OVERVIEW_SCOPE_VALUES] },
    instanceId: { type: "string", nullable: true },
    instanceName: { type: "string", nullable: true },
    timeZone: { type: "string" },
    nextRunAt: { type: "string", format: "date-time", nullable: true },
    lastRun: {
      type: "object",
      properties: {
        at: { type: "string", format: "date-time", nullable: true },
        status: { type: "string", enum: [...OVERVIEW_AUTOMATIC_IMPORT_RUN_STATUS_VALUES], nullable: true },
        jobCount: { type: "number" },
        skippedCount: { type: "number" },
        errorMessage: { type: "string", nullable: true },
      },
      required: ["at", "status", "jobCount", "skippedCount", "errorMessage"],
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "name",
    "enabled",
    "cronExpression",
    "scope",
    "instanceId",
    "instanceName",
    "timeZone",
    "nextRunAt",
    "lastRun",
    "createdAt",
    "updatedAt",
  ],
};

const jobCheckpointSchema = {
  type: "object",
  nullable: true,
  properties: {
    instanceId: { type: "string", nullable: true },
    instanceName: { type: "string", nullable: true },
    page: { type: "number", nullable: true },
    start: { type: "number", nullable: true },
    totalPages: { type: "number", nullable: true },
    expectedRecords: { type: "number", nullable: true },
    consecutiveFailures: { type: "number" },
    lastSuccessfulPage: { type: "number" },
    updatedAt: { type: "string", format: "date-time", nullable: true },
  },
  required: [
    "instanceId",
    "instanceName",
    "page",
    "start",
    "totalPages",
    "expectedRecords",
    "consecutiveFailures",
    "lastSuccessfulPage",
    "updatedAt",
  ],
};

const jobInstanceProgressSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    status: { type: "string", enum: [...OVERVIEW_JOB_STATUS_VALUES] },
    expectedRecords: { type: "number", nullable: true },
    fetchedRecords: { type: "number" },
    insertedRecords: { type: "number" },
    totalPages: { type: "number", nullable: true },
    completedPages: { type: "number" },
    currentPage: { type: "number", nullable: true },
    currentStart: { type: "number" },
    storedFrom: { type: "string", format: "date-time", nullable: true },
    storedUntil: { type: "string", format: "date-time", nullable: true },
    consecutiveFailures: { type: "number" },
    lastErrorMessage: { type: "string", nullable: true },
    lastFailureReason: { type: "string", enum: [...OVERVIEW_JOB_FAILURE_REASON_VALUES], nullable: true },
    lastSuccessfulAt: { type: "string", format: "date-time", nullable: true },
    updatedAt: { type: "string", format: "date-time", nullable: true },
  },
  required: [
    "instanceId",
    "instanceName",
    "status",
    "expectedRecords",
    "fetchedRecords",
    "insertedRecords",
    "totalPages",
    "completedPages",
    "currentPage",
    "currentStart",
    "storedFrom",
    "storedUntil",
    "consecutiveFailures",
    "lastErrorMessage",
    "lastFailureReason",
    "lastSuccessfulAt",
    "updatedAt",
  ],
};

const jobProgressSchema = {
  type: "object",
  properties: {
    attempts: { type: "number" },
    totalExpectedRecords: { type: "number" },
    totalFetchedRecords: { type: "number" },
    totalInsertedRecords: { type: "number" },
    totalPages: { type: "number" },
    completedPages: { type: "number" },
    checkpoint: jobCheckpointSchema,
    lastFailureMessage: { type: "string", nullable: true },
    lastFailureReason: { type: "string", enum: [...OVERVIEW_JOB_FAILURE_REASON_VALUES], nullable: true },
    instanceProgress: { type: "array", items: jobInstanceProgressSchema },
  },
  required: [
    "attempts",
    "totalExpectedRecords",
    "totalFetchedRecords",
    "totalInsertedRecords",
    "totalPages",
    "completedPages",
    "checkpoint",
    "lastFailureMessage",
    "lastFailureReason",
    "instanceProgress",
  ],
};

const overviewJobSummarySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: [...OVERVIEW_JOB_KIND_VALUES] },
    scope: { type: "string", enum: [...OVERVIEW_SCOPE_VALUES] },
    instanceId: { type: "string", nullable: true },
    instanceName: { type: "string", nullable: true },
    requestedFrom: { type: "string", format: "date-time" },
    requestedUntil: { type: "string", format: "date-time" },
    status: { type: "string", enum: [...OVERVIEW_JOB_STATUS_VALUES] },
    trigger: { type: "string", nullable: true },
    requestedBy: { type: "string", nullable: true },
    queryCount: { type: "number" },
    deletedCount: { type: "number" },
    coverageCount: { type: "number" },
    startedAt: { type: "string", format: "date-time", nullable: true },
    finishedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    errorMessage: { type: "string", nullable: true },
    failureReason: { type: "string", enum: [...OVERVIEW_JOB_FAILURE_REASON_VALUES], nullable: true },
    progress: jobProgressSchema,
  },
  required: [
    "id",
    "kind",
    "scope",
    "instanceId",
    "instanceName",
    "requestedFrom",
    "requestedUntil",
    "status",
    "trigger",
    "requestedBy",
    "queryCount",
    "deletedCount",
    "coverageCount",
    "startedAt",
    "finishedAt",
    "createdAt",
    "errorMessage",
    "failureReason",
    "progress",
  ],
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
  schema: {
    type: "object",
    properties: {
      jobs: { type: "array", items: overviewJobSummarySchema },
    },
    required: ["jobs"],
  },
};

export const OVERVIEW_JOB_DETAILS_API_OK_RESPONSE = {
  description: "Detailed overview history job progress and timeline.",
};

export const OVERVIEW_JOB_MUTATION_API_OK_RESPONSE = {
  description: "Mutated overview history job queue.",
  schema: {
    type: "object",
    properties: {
      jobs: { type: "array", items: overviewJobSummarySchema },
      job: { ...overviewJobSummarySchema, nullable: true },
      summary: {
        type: "object",
        properties: {
          requestedCount: { type: "number" },
          createdCount: { type: "number" },
          reusedCount: { type: "number" },
          skippedCount: { type: "number" },
        },
        required: ["requestedCount", "createdCount", "reusedCount", "skippedCount"],
      },
    },
    required: ["jobs", "job", "summary"],
  },
};

export const OVERVIEW_JOB_DELETE_API_OK_RESPONSE = {
  description: "Deleted overview history job.",
  schema: {
    type: "object",
    properties: {
      job: overviewJobSummarySchema,
    },
    required: ["job"],
  },
};

export const OVERVIEW_COVERAGE_RENEW_API_OK_RESPONSE = {
  description: "Renewed overview coverage retention without refetching data.",
};

export const OVERVIEW_AUTOMATIC_IMPORTS_API_OK_RESPONSE = {
  description: "Configured automatic overview import rules.",
  schema: {
    type: "object",
    properties: {
      timeZone: { type: "string" },
      rules: { type: "array", items: automaticImportRuleSchema },
    },
    required: ["timeZone", "rules"],
  },
};

export const OVERVIEW_AUTOMATIC_IMPORT_RULE_MUTATION_API_OK_RESPONSE = {
  description: "Configured automatic overview import rule.",
  schema: {
    type: "object",
    properties: {
      rule: automaticImportRuleSchema,
    },
    required: ["rule"],
  },
};
