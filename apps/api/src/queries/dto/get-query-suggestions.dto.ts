import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { QUERIES_SCOPE_VALUES, type QueriesScopeMode } from "../queries.types";

export class GetQuerySuggestionsDto {
  @ApiPropertyOptional({ enum: QUERIES_SCOPE_VALUES, default: "all" })
  @Transform(({ value }) => value ?? "all")
  @IsIn(QUERIES_SCOPE_VALUES)
  scope!: QueriesScopeMode;

  @ApiPropertyOptional({ example: "clw5i2x560001szyf2c4qz7cf" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  instanceId?: string;
}
