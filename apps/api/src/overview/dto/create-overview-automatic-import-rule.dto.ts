import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { OVERVIEW_SCOPE_VALUES, type OverviewScopeMode } from "../overview.types";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}

export class CreateOverviewAutomaticImportRuleDto {
  @ApiProperty({ example: "Importacao diaria principal" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ example: "0 03 * * *" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  cronExpression!: string;

  @ApiPropertyOptional({ enum: OVERVIEW_SCOPE_VALUES, default: "all" })
  @IsOptional()
  @IsIn(OVERVIEW_SCOPE_VALUES)
  scope?: OverviewScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;
}
