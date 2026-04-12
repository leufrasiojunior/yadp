import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

import { BACKEND_CONFIG } from "../../config/backend-config";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

export class GetNotificationsPreviewDto {
  @ApiPropertyOptional({
    example: BACKEND_CONFIG.notifications.previewLimit,
    default: BACKEND_CONFIG.notifications.previewLimit,
  })
  @Transform(({ value }) => clampInteger(value, 1, 20, BACKEND_CONFIG.notifications.previewLimit))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit = BACKEND_CONFIG.notifications.previewLimit;
}
