import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";

export const SETUP_CREDENTIAL_MODES = ["shared", "individual"] as const;
export type SetupCredentialMode = (typeof SETUP_CREDENTIAL_MODES)[number];

export const SETUP_LOGIN_MODES = ["pihole-master", "yapd-password"] as const;
export type SetupLoginMode = (typeof SETUP_LOGIN_MODES)[number];

export class SetupInstanceDto {
  @ApiPropertyOptional({ example: "Pi-hole Principal" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: "https://pi.hole" })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  baseUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMaster?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;

  @ApiPropertyOptional({ example: "instance-password" })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  password?: string;
}

export class CreateBaselineDto {
  @ApiProperty({ enum: SETUP_CREDENTIAL_MODES, example: "shared" })
  @IsIn(SETUP_CREDENTIAL_MODES)
  credentialsMode!: SetupCredentialMode;

  @ApiPropertyOptional({ example: "shared-application-password" })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  sharedPassword?: string;

  @ApiProperty({ type: [SetupInstanceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SetupInstanceDto)
  instances!: SetupInstanceDto[];

  @ApiProperty({ enum: SETUP_LOGIN_MODES, example: "pihole-master" })
  @IsIn(SETUP_LOGIN_MODES)
  loginMode!: SetupLoginMode;

  @ApiPropertyOptional({ example: "my-yapd-password" })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  yapdPassword?: string;
}
