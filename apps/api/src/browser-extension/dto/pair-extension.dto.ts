import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class PairExtensionDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/)
  pairingCode!: string;

  @ApiProperty({ example: "YAPD Inspector" })
  @IsString()
  @MaxLength(100)
  extensionName!: string;

  @ApiProperty({ example: "chrome-or-edge" })
  @IsString()
  @MaxLength(100)
  browser!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(3)
  @Max(3)
  manifestVersion!: number;

  @ApiProperty({ example: "0.1.0" })
  @IsString()
  @MaxLength(50)
  extensionVersion!: string;
}
