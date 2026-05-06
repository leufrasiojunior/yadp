import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

import { OVERVIEW_SCOPE_VALUES, type OverviewScopeMode } from "../overview.types";
import { parseOptionalNumber } from "./overview-query-parsers";

export class CreateOverviewHistoryJobDto {
  @ApiProperty({ enum: OVERVIEW_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(OVERVIEW_SCOPE_VALUES)
  scope!: OverviewScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;

  @ApiProperty({ example: 1774911000 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  from!: number;

  @ApiProperty({ example: 1774997399 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  until!: number;
}
