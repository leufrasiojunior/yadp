import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsNumber, Min } from "class-validator";

import { BACKEND_CONFIG } from "../../config/backend-config";
import { NOTIFICATION_READ_STATES, type NotificationReadState } from "../notifications.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

const MAX_NOTIFICATIONS_PAGE = 1_000;
const MAX_NOTIFICATIONS_PAGE_SIZE = 100;

export class GetNotificationsDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => clampInteger(value, 1, MAX_NOTIFICATIONS_PAGE, 1))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    example: BACKEND_CONFIG.notifications.defaultPageSize,
    default: BACKEND_CONFIG.notifications.defaultPageSize,
  })
  @Transform(({ value }) =>
    clampInteger(value, 1, MAX_NOTIFICATIONS_PAGE_SIZE, BACKEND_CONFIG.notifications.defaultPageSize),
  )
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize = BACKEND_CONFIG.notifications.defaultPageSize;

  @ApiPropertyOptional({
    enum: NOTIFICATION_READ_STATES,
    default: "unread",
  })
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return "unread";
    }

    const normalized = value.trim().toLowerCase();
    return NOTIFICATION_READ_STATES.includes(normalized as NotificationReadState) ? normalized : "unread";
  })
  @IsIn(NOTIFICATION_READ_STATES)
  readState: NotificationReadState = "unread";
}
