import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from "class-validator";

import { GROUP_BATCH_DELETE_MAX_ITEMS, GROUP_NAME_MAX_LENGTH, NormalizeGroupNameArray } from "./group-validation";

export class BatchDeleteGroupsDto {
  @ApiProperty({
    type: [String],
    example: ["test_group", "another_group"],
  })
  @NormalizeGroupNameArray()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GROUP_BATCH_DELETE_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(GROUP_NAME_MAX_LENGTH, { each: true })
  items!: string[];
}
