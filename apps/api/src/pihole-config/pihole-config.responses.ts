import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

import { PIHOLE_CONFIG_TOPICS, PIHOLE_REQUEST_ERROR_KINDS } from "../pihole/pihole.types";
import { CONFIG_MUTATION_STATUSES, CONFIG_SYNC_STATUSES } from "./pihole-config.types";

const flagsSchema = {
  type: "object",
  properties: {
    restart_dnsmasq: { type: "boolean" },
    session_reset: { type: "boolean" },
    env_var: { type: "boolean" },
  },
  required: ["restart_dnsmasq", "session_reset", "env_var"],
};

const instanceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    isBaseline: { type: "boolean" },
    syncEnabled: { type: "boolean" },
  },
  required: ["instanceId", "instanceName", "isBaseline", "syncEnabled"],
};

const fieldSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    key: { type: "string" },
    groupPath: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    allowed: { nullable: true },
    type: { type: "string", nullable: true },
    value: { nullable: true },
    defaultValue: { nullable: true },
    modified: { type: "boolean" },
    flags: flagsSchema,
    isIgnored: { type: "boolean" },
    ignoreRuleId: { type: "string", nullable: true },
    sync: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...CONFIG_SYNC_STATUSES] },
        isFullySynced: { type: "boolean" },
        sourceInstances: { type: "array", items: instanceSchema },
        missingInstances: { type: "array", items: instanceSchema },
      },
      required: ["status", "isFullySynced", "sourceInstances", "missingInstances"],
    },
  },
  required: [
    "path",
    "key",
    "groupPath",
    "description",
    "allowed",
    "type",
    "value",
    "defaultValue",
    "modified",
    "flags",
    "isIgnored",
    "ignoreRuleId",
    "sync",
  ],
};

const failedInstanceSchema = {
  type: "object",
  properties: {
    instanceId: { type: "string" },
    instanceName: { type: "string" },
    isBaseline: { type: "boolean" },
    syncEnabled: { type: "boolean" },
    kind: { type: "string", enum: [...PIHOLE_REQUEST_ERROR_KINDS] },
    message: { type: "string" },
  },
  required: ["instanceId", "instanceName", "isBaseline", "syncEnabled", "kind", "message"],
};

const topicSchema = {
  type: "object",
  properties: {
    name: { type: "string", enum: [...PIHOLE_CONFIG_TOPICS] },
    title: { type: "string" },
    description: { type: "string", nullable: true },
    value: { nullable: true },
    detailed: {
      type: "object",
      additionalProperties: true,
    },
    fields: {
      type: "array",
      items: fieldSchema,
    },
    sync: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...CONFIG_SYNC_STATUSES] },
        isFullySynced: { type: "boolean" },
        availableInstanceCount: { type: "number" },
        unavailableInstanceCount: { type: "number" },
        sourceInstances: { type: "array", items: instanceSchema },
        missingInstances: { type: "array", items: instanceSchema },
      },
      required: [
        "status",
        "isFullySynced",
        "availableInstanceCount",
        "unavailableInstanceCount",
        "sourceInstances",
        "missingInstances",
      ],
    },
  },
  required: ["name", "title", "description", "value", "detailed", "fields", "sync"],
};

const ignoredFieldSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    topic: { type: "string", enum: [...PIHOLE_CONFIG_TOPICS] },
    fieldPath: { type: "string" },
  },
  required: ["id", "topic", "fieldPath"],
};

const driftItemSchema = {
  type: "object",
  properties: {
    topic: { type: "string", enum: [...PIHOLE_CONFIG_TOPICS] },
    topicTitle: { type: "string" },
    fieldPath: { type: "string" },
    fieldKey: { type: "string" },
    groupPath: { type: "string", nullable: true },
  },
  required: ["topic", "topicTitle", "fieldPath", "fieldKey", "groupPath"],
};

export const CONFIG_OVERVIEW_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      topics: { type: "array", items: topicSchema },
      driftItems: { type: "array", items: driftItemSchema },
      ignoredFields: { type: "array", items: ignoredFieldSchema },
      source: {
        type: "object",
        properties: {
          baselineInstanceId: { type: "string" },
          baselineInstanceName: { type: "string" },
          defaultSourceInstanceId: { type: "string" },
          defaultSourceInstanceName: { type: "string" },
          totalInstances: { type: "number" },
          availableInstanceCount: { type: "number" },
          unavailableInstanceCount: { type: "number" },
        },
        required: [
          "baselineInstanceId",
          "baselineInstanceName",
          "defaultSourceInstanceId",
          "defaultSourceInstanceName",
          "totalInstances",
          "availableInstanceCount",
          "unavailableInstanceCount",
        ],
      },
      instances: { type: "array", items: instanceSchema },
      unavailableInstances: { type: "array", items: failedInstanceSchema },
    },
    required: ["topics", "driftItems", "ignoredFields", "source", "instances", "unavailableInstances"],
  },
};

export const CONFIG_TOPIC_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      topic: topicSchema,
      sourceInstance: instanceSchema,
    },
    required: ["topic", "sourceInstance"],
  },
};

export const CONFIG_MUTATION_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...CONFIG_MUTATION_STATUSES] },
      summary: {
        type: "object",
        properties: {
          totalInstances: { type: "number" },
          successfulCount: { type: "number" },
          failedCount: { type: "number" },
        },
        required: ["totalInstances", "successfulCount", "failedCount"],
      },
      successfulInstances: { type: "array", items: instanceSchema },
      failedInstances: { type: "array", items: failedInstanceSchema },
    },
    required: ["status", "summary", "successfulInstances", "failedInstances"],
  },
};

export const CONFIG_IGNORE_RULE_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      rule: ignoredFieldSchema,
    },
    required: ["rule"],
  },
};
