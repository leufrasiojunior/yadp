import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";

export const PRODUCT_TOUR_STATUS_API_OK_RESPONSE = {
  description: "Product tour completion status for the current browser.",
  schema: {
    type: "object",
    properties: {
      tourKey: { type: "string", example: "overview-v1" },
      completed: { type: "boolean" },
      completedAt: { type: "string", format: "date-time", nullable: true },
    },
    required: ["tourKey", "completed", "completedAt"],
  },
} satisfies ApiResponseNoStatusOptions;
