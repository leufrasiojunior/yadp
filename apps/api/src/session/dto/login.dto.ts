import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "my-pihole-password" })
  @IsString()
  @MaxLength(512)
  password!: string;

  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  totp?: string;
}
