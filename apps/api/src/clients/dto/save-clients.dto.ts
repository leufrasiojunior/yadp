import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

import { TrimStringAllowEmpty } from "../../groups/dto/group-validation";
import { MAX_CLIENT_TAG_LENGTH, normalizeClientTags } from "../client-tags";

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = [...new Set(value.map((item) => Number(item)).filter((item) => Number.isFinite(item)))];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTagArray(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return normalizeClientTags(value.map((item) => (typeof item === "string" ? item : "")));
}

export class SaveClientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  client!: string[];

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @TrimStringAllowEmpty()
  @IsString()
  @MaxLength(191)
  alias?: string;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @TrimStringAllowEmpty()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }) => normalizeNumberArray(value))
  @Type(() => Number)
  @IsNumber({}, { each: true })
  groups?: number[];

  @ApiPropertyOptional({ example: ["IoT", "Camera"] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeTagArray(value))
  @IsString({ each: true })
  @MaxLength(MAX_CLIENT_TAG_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  targetInstanceIds?: string[];
}
