import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

import {
  DEFAULT_QUERIES_LENGTH,
  MAX_QUERIES_LENGTH,
  MAX_QUERIES_START,
  QUERIES_SCOPE_VALUES,
  type QueriesScopeMode,
} from "../queries.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function parseOptionalNumber(value: unknown) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

export class GetQueriesDto {
  @ApiPropertyOptional({ enum: QUERIES_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(QUERIES_SCOPE_VALUES)
  scope!: QueriesScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;

  @ApiPropertyOptional({ example: 1774911000 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  from?: number;

  @ApiPropertyOptional({ example: 1774912000 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  until?: number;

  @ApiPropertyOptional({ example: DEFAULT_QUERIES_LENGTH, default: DEFAULT_QUERIES_LENGTH })
  @Transform(({ value }) => clampInteger(value, 1, MAX_QUERIES_LENGTH, DEFAULT_QUERIES_LENGTH))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  length!: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @Transform(({ value }) => clampInteger(value, 0, MAX_QUERIES_START, 0))
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  start!: number;

  @ApiPropertyOptional({ example: 15219553 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  cursor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  domain?: string;

  @ApiPropertyOptional({ name: "client_ip" })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  client_ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  upstream?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reply?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dnssec?: string;

  @ApiPropertyOptional({ default: false })
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  disk?: boolean;
}
