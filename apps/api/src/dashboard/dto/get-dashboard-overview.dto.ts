import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { DASHBOARD_OVERVIEW_SCOPE_VALUES, type DashboardOverviewScopeMode } from "../dashboard.types";

export class GetDashboardOverviewDto {
  @ApiPropertyOptional({ enum: DASHBOARD_OVERVIEW_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(DASHBOARD_OVERVIEW_SCOPE_VALUES)
  scope!: DashboardOverviewScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;
}
