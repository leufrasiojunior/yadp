import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import {
  GROUP_COMMENT_MAX_LENGTH,
  IsParsableGroupNamesInput,
  TrimRequiredString,
  TrimStringAllowEmpty,
} from "./group-validation";

export class CreateGroupsDto {
  @ApiProperty({
    example: 'group-one, "My New Group"',
    description: "One or more group names separated by spaces or commas. Use quotes to preserve spaces.",
  })
  @TrimRequiredString()
  @IsString()
  @MinLength(1)
  @IsParsableGroupNamesInput()
  name!: string;

  @ApiPropertyOptional({ example: "Shared comment for the created groups." })
  @IsOptional()
  @TrimStringAllowEmpty()
  @IsString()
  @MaxLength(GROUP_COMMENT_MAX_LENGTH)
  comment?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
