import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateGroupStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}
