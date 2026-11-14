import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

import {
  BROWSER_EXTENSION_BATCH_STATUS_VALUES,
  BROWSER_EXTENSION_DEFAULT_PAGE_SIZE,
  BROWSER_EXTENSION_MAX_PAGE_SIZE,
  type BrowserExtensionBatchStatus,
} from "../browser-extension.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

export class GetExtensionDetectionsDto {
  @ApiPropertyOptional({ example: "example.com" })
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(253)
  @IsOptional()
  pageDomain?: string;

  @ApiPropertyOptional({ example: "ads.example.com" })
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(253)
  @IsOptional()
  target?: string;

  @ApiPropertyOptional({ example: "ads" })
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: BROWSER_EXTENSION_BATCH_STATUS_VALUES, example: "applied" })
  @IsIn(BROWSER_EXTENSION_BATCH_STATUS_VALUES)
  @IsOptional()
  status?: BrowserExtensionBatchStatus;

  @ApiPropertyOptional({ example: "2026-07-02T00:00:00.000Z" })
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-02T23:59:59.999Z" })
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsOptional()
  until?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => clampInteger(value, 1, 999, 1))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: BROWSER_EXTENSION_DEFAULT_PAGE_SIZE, default: BROWSER_EXTENSION_DEFAULT_PAGE_SIZE })
  @Transform(({ value }) =>
    clampInteger(value, 1, BROWSER_EXTENSION_MAX_PAGE_SIZE, BROWSER_EXTENSION_DEFAULT_PAGE_SIZE),
  )
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize = BROWSER_EXTENSION_DEFAULT_PAGE_SIZE;
}
