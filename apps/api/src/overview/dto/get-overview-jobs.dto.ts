import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNumber, Min } from "class-validator";

import { clampInteger } from "./overview-query-parsers";

const DEFAULT_JOBS_LIMIT = 20;
const MAX_JOBS_LIMIT = 100;

export class GetOverviewJobsDto {
  @ApiPropertyOptional({ example: DEFAULT_JOBS_LIMIT, default: DEFAULT_JOBS_LIMIT })
  @Transform(({ value }) => clampInteger(value, 1, MAX_JOBS_LIMIT, DEFAULT_JOBS_LIMIT))
  @IsNumber()
  @Min(1)
  limit = DEFAULT_JOBS_LIMIT;
}
