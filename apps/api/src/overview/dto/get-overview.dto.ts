import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

import {
  OVERVIEW_GROUP_BY_VALUES,
  OVERVIEW_SCOPE_VALUES,
  type OverviewGroupBy,
  type OverviewScopeMode,
} from "../overview.types";
import { parseOptionalNumber, trimOptionalString } from "./overview-query-parsers";

export class GetOverviewDto {
  @ApiPropertyOptional({ enum: OVERVIEW_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(OVERVIEW_SCOPE_VALUES)
  scope!: OverviewScopeMode;

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

  @ApiPropertyOptional({ example: 1774997399 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  until?: number;

  @ApiPropertyOptional({ enum: OVERVIEW_GROUP_BY_VALUES, default: "hour" })
  @Transform(({ value }) => value ?? "hour")
  @IsIn(OVERVIEW_GROUP_BY_VALUES)
  groupBy!: OverviewGroupBy;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(512)
  domain?: string;

  @ApiPropertyOptional({ name: "client_ip" })
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(512)
  client_ip?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(512)
  upstream?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  status?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reply?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dnssec?: string;
}
