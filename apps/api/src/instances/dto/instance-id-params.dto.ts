import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

import { TrimRequiredString } from "./instance-validation";

export class InstanceIdParamsDto {
  @ApiProperty({ example: "clw5i2x560001szyf2c4qz7cf" })
  @TrimRequiredString()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  id!: string;
}
