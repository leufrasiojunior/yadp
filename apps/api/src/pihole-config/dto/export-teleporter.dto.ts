import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ExportTeleporterDto {
  @ApiProperty({
    description: "Optional instance to export from. Defaults to the baseline.",
    example: "clz-baseline",
    required: false,
  })
  @IsString()
  @IsOptional()
  instanceId?: string;
}
