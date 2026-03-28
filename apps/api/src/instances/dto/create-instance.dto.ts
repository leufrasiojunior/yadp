import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateInstanceDto {
  @ApiProperty({ example: "Pi-hole Sala" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "https://pihole.lan" })
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  baseUrl!: string;

  @ApiProperty({ example: "service-password" })
  @IsString()
  @MaxLength(512)
  servicePassword!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificatePem?: string;
}
