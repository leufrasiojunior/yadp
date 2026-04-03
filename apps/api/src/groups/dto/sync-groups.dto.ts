import { ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

import { GROUP_NAME_MAX_LENGTH } from "./group-validation";

export class SyncGroupsDto {
  @IsOptional()
  @IsString()
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  groupName?: string;

  @IsOptional()
  @IsString()
  sourceInstanceId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  targetInstanceIds?: string[];
}
