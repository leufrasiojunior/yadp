import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateInstanceSyncDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;
}
