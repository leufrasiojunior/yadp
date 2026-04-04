import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UpdateSessionPreferencesDto {
  @ApiProperty({ example: "America/Sao_Paulo" })
  @IsString()
  @MaxLength(120)
  timeZone!: string;
}
