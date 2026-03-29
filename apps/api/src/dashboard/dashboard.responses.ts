import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { DASHBOARD_OVERVIEW_SCOPE_VALUES } from "./dashboard.types";

const dashboardInstanceSourceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
  },
  required: ["instanceId", "instanceName"],
};

const dashboardFailedInstanceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    kind: { type: "string", enum: [...PIHOLE_REQUEST_ERROR_KINDS] },
    message: { type: "string" },
  },
  required: ["instanceId", "instanceName", "kind", "message"],
};

export const DASHBOARD_OVERVIEW_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      scope: {
        type: "object",
        properties: {
          mode: { type: "string", enum: [...DASHBOARD_OVERVIEW_SCOPE_VALUES] },
          instanceId: { type: "string", nullable: true },
          instanceName: { type: "string", nullable: true },
        },
        required: ["mode", "instanceId", "instanceName"],
      },
      summary: {
        type: "object",
        properties: {
          totalQueries: { type: "number" },
          queriesBlocked: { type: "number" },
          percentageBlocked: { type: "number" },
          domainsOnList: { type: "number" },
        },
        required: ["totalQueries", "queriesBlocked", "percentageBlocked", "domainsOnList"],
      },
      charts: {
        type: "object",
        properties: {
          totalQueries: {
            type: "object",
            properties: {
              points: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string", format: "date-time" },
                    totalQueries: { type: "number" },
                    cachedQueries: { type: "number" },
                    blockedQueries: { type: "number" },
                    forwardedQueries: { type: "number" },
                    percentageBlocked: { type: "number" },
                  },
                  required: [
                    "timestamp",
                    "totalQueries",
                    "cachedQueries",
                    "blockedQueries",
                    "forwardedQueries",
                    "percentageBlocked",
                  ],
                },
              },
            },
            required: ["points"],
          },
          clientActivity: {
            type: "object",
            properties: {
              series: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    totalQueries: { type: "number" },
                    points: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          timestamp: { type: "string", format: "date-time" },
                          queries: { type: "number" },
                        },
                        required: ["timestamp", "queries"],
                      },
                    },
                  },
                  required: ["key", "label", "totalQueries", "points"],
                },
              },
            },
            required: ["series"],
          },
        },
        required: ["totalQueries", "clientActivity"],
      },
      sources: {
        type: "object",
        properties: {
          totalInstances: { type: "number" },
          successfulInstances: {
            type: "array",
            items: dashboardInstanceSourceSchema,
          },
          failedInstances: {
            type: "array",
            items: dashboardFailedInstanceSchema,
          },
        },
        required: ["totalInstances", "successfulInstances", "failedInstances"],
      },
    },
    required: ["scope", "summary", "charts", "sources"],
  },
};
