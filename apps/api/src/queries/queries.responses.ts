import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_QUERY_SUGGESTION_KEYS, PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";

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

const queryLogSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    id: { type: "number" },
    time: { type: "string", format: "date-time" },
    type: { type: "string", nullable: true },
    status: { type: "string", nullable: true },
    dnssec: { type: "string", nullable: true },
    domain: { type: "string", nullable: true },
    upstream: { type: "string", nullable: true },
    reply: {
      type: "object",
      nullable: true,
      properties: {
        type: { type: "string", nullable: true },
        time: { type: "number", nullable: true },
      },
      required: ["type", "time"],
    },
    client: {
      type: "object",
      nullable: true,
      properties: {
        ip: { type: "string", nullable: true },
        name: { type: "string", nullable: true },
      },
      required: ["ip", "name"],
    },
    listId: { type: "number", nullable: true },
    ede: {
      type: "object",
      nullable: true,
      properties: {
        code: { type: "number", nullable: true },
        text: { type: "string", nullable: true },
      },
      required: ["code", "text"],
    },
    cname: { type: "string", nullable: true },
  },
  required: [
    "instanceId",
    "instanceName",
    "id",
    "time",
    "type",
    "status",
    "dnssec",
    "domain",
    "upstream",
    "reply",
    "client",
    "listId",
    "ede",
    "cname",
  ],
};

const sourcesSchema = {
  type: "object",
  properties: {
    totalInstances: { type: "number" },
    successfulInstances: {
      type: "array",
      items: instanceSourceSchema,
    },
    failedInstances: {
      type: "array",
      items: failedInstanceSchema,
    },
  },
  required: ["totalInstances", "successfulInstances", "failedInstances"],
};

export const QUERIES_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      queries: {
        type: "array",
        items: queryLogSchema,
      },
      cursor: { type: "number", nullable: true },
      recordsTotal: { type: "number" },
      recordsFiltered: { type: "number" },
      earliestTimestamp: { type: "string", format: "date-time", nullable: true },
      earliestTimestampDisk: { type: "string", format: "date-time", nullable: true },
      took: { type: "number" },
      sources: sourcesSchema,
    },
    required: [
      "queries",
      "cursor",
      "recordsTotal",
      "recordsFiltered",
      "earliestTimestamp",
      "earliestTimestampDisk",
      "took",
      "sources",
    ],
  },
};

const suggestionsProperties = Object.fromEntries(
  PIHOLE_QUERY_SUGGESTION_KEYS.map((key) => [
    key,
    {
      type: "array",
      items: {
        type: "string",
      },
    },
  ]),
);

export const QUERY_SUGGESTIONS_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "object",
        properties: suggestionsProperties,
        required: [...PIHOLE_QUERY_SUGGESTION_KEYS],
      },
      took: { type: "number" },
      sources: sourcesSchema,
    },
    required: ["suggestions", "took", "sources"],
  },
};
