import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateBaselineDto {
  @ApiProperty({ example: "Pi-hole Principal" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "https://pi.hole" })
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  baseUrl!: string;

  @ApiProperty({ example: "my-application-password" })
  @IsString()
  @MaxLength(512)
  servicePassword!: string;

  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  totp?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificatePem?: string;
}
