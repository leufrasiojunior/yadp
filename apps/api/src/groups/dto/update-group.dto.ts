import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import {
  GROUP_COMMENT_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  TrimRequiredString,
  TrimStringAllowEmpty,
} from "./group-validation";

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: "Analytics Group" })
  @TrimRequiredString()
  @IsString()
  @MinLength(1)
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({ example: "Updated group comment." })
  @IsOptional()
  @TrimStringAllowEmpty()
  @IsString()
  @MaxLength(GROUP_COMMENT_MAX_LENGTH)
  comment?: string;
}
