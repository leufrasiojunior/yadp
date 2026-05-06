import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class OverviewJobIdParamsDto {
  @ApiProperty({ example: "cm1234567890abcdef123456" })
  @IsString()
  @MaxLength(191)
  id!: string;
}
