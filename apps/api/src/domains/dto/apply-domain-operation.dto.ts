import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { DOMAIN_SCOPE_VALUES, type DomainScopeMode } from "../domains.types";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ApplyDomainOperationDto {
  @ApiProperty({ example: "api.msn.com" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  domain!: string;

  @ApiPropertyOptional({ enum: DOMAIN_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(DOMAIN_SCOPE_VALUES)
  scope!: DomainScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;

  @ApiPropertyOptional({ example: "Added from Query Log" })
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;
}
