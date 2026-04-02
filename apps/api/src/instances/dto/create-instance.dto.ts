import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

import {
  IsExclusiveTrustConfiguration,
  IsPemCertificateBundle,
  TrimOptionalString,
  TrimRequiredString,
} from "./instance-validation";

export class CreateInstanceDto {
  @ApiProperty({ example: "Pi-hole Sala" })
  @TrimRequiredString()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "https://pihole.lan" })
  @TrimRequiredString()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  baseUrl!: string;

  @ApiProperty({ example: "service-password" })
  @TrimRequiredString()
  @IsString()
  @MinLength(4)
  @MaxLength(512)
  servicePassword!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOptionalString()
  @IsString()
  @IsPemCertificateBundle()
  @IsExclusiveTrustConfiguration()
  certificatePem?: string;
}
