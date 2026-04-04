import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

import { TrimStringAllowEmpty } from "../../groups/dto/group-validation";

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  targetInstanceIds?: string[];
}
