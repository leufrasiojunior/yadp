import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import {
  IsExclusiveTrustConfiguration,
  IsManagedInstanceBaseUrl,
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
  @IsManagedInstanceBaseUrl()
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
