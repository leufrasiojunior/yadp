import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

import { GROUP_NAME_MAX_LENGTH, TrimRequiredString } from "./group-validation";

export class GroupNameParamsDto {
  @ApiProperty({ example: "AD_Unblock" })
  @TrimRequiredString()
  @IsString()
  @MinLength(1)
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name!: string;
}
