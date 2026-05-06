import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

export const NAVIGATION_SUMMARY_API_OK_RESPONSE: ApiResponseNoStatusOptions = {
  schema: {
    type: "object",
    properties: {
      groups: {
        type: "object",
        properties: {
          total: { type: "number" },
        },
        required: ["total"],
      },
      lists: {
        type: "object",
        properties: {
          total: { type: "number" },
        },
        required: ["total"],
      },
      domains: {
        type: "object",
        properties: {
          total: { type: "number" },
        },
        required: ["total"],
      },
    },
    required: ["groups", "lists", "domains"],
  },
};
