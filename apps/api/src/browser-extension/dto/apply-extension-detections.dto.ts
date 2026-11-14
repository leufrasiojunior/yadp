import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  BROWSER_EXTENSION_KIND_VALUES,
  BROWSER_EXTENSION_PATTERN_MODE_VALUES,
  BROWSER_EXTENSION_RISK_LEVEL_VALUES,
  type BrowserExtensionKind,
  type BrowserExtensionPatternMode,
  type BrowserExtensionRiskLevel,
} from "../browser-extension.types";

export class ApplyExtensionMetadataDto {
  @ApiProperty({ example: "YAPD Inspector" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "clw-extension" })
  @IsString()
  extensionId!: string;

  @ApiProperty({ example: "0.1.0" })
  @IsString()
  @MaxLength(50)
  version!: string;

  @ApiProperty({ example: "chrome-or-edge" })
  @IsString()
  @MaxLength(100)
  browser!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(3)
  @Max(3)
  manifestVersion!: number;
}

export class ApplyExtensionPageDto {
  @ApiProperty({ example: "https://example.com/article" })
  @IsString()
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ example: "example.com" })
  @IsString()
  @MaxLength(253)
  domain!: string;

  @ApiPropertyOptional({ example: "Example page" })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  title?: string;
}

export class ApplyExtensionEvidenceDto {
  @ApiPropertyOptional({ example: "https://ads.example.net/banner.js" })
  @IsString()
  @MaxLength(2048)
  @IsOptional()
  url?: string;

  @ApiProperty({ example: "performance_resource" })
  @IsString()
  @MaxLength(100)
  source!: string;

  @ApiPropertyOptional({ example: "script" })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  resourceType?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isThirdParty!: boolean;
}

export class ApplyExtensionTargetDto {
  @ApiProperty({ example: "candidate-1" })
  @IsString()
  @MaxLength(120)
  candidateId!: string;

  @ApiProperty({ example: "ads.example.net" })
  @IsString()
  @MaxLength(253)
  target!: string;

  @ApiProperty({ enum: ["deny"], example: "deny" })
  @IsIn(["deny"])
  type!: "deny";

  @ApiProperty({ enum: BROWSER_EXTENSION_KIND_VALUES, example: "exact" })
  @IsIn(BROWSER_EXTENSION_KIND_VALUES)
  kind!: BrowserExtensionKind;

  @ApiPropertyOptional({ enum: BROWSER_EXTENSION_PATTERN_MODE_VALUES, example: "exact" })
  @IsIn(BROWSER_EXTENSION_PATTERN_MODE_VALUES)
  @IsOptional()
  patternMode?: BrowserExtensionPatternMode;

  @ApiProperty({ example: "ads" })
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 85 })
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @ApiProperty({ enum: BROWSER_EXTENSION_RISK_LEVEL_VALUES, example: "high" })
  @IsIn(BROWSER_EXTENSION_RISK_LEVEL_VALUES)
  riskLevel!: BrowserExtensionRiskLevel;

  @ApiProperty({ type: [String], example: ["Third-party ad-like script"] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  reasons!: string[];

  @ApiProperty({ type: ApplyExtensionEvidenceDto })
  @ValidateNested()
  @Type(() => ApplyExtensionEvidenceDto)
  evidence!: ApplyExtensionEvidenceDto;
}

export class ApplyExtensionDetectionsDto {
  @ApiProperty({ enum: ["browser_extension"], example: "browser_extension" })
  @IsIn(["browser_extension"])
  source!: "browser_extension";

  @ApiProperty({ type: ApplyExtensionMetadataDto })
  @ValidateNested()
  @Type(() => ApplyExtensionMetadataDto)
  extension!: ApplyExtensionMetadataDto;

  @ApiProperty({ example: "request-uuid" })
  @IsString()
  @MaxLength(120)
  clientRequestId!: string;

  @ApiPropertyOptional({ example: "clw-detected-batch" })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  sourceBatchId?: string;

  @ApiProperty({ type: ApplyExtensionPageDto })
  @ValidateNested()
  @Type(() => ApplyExtensionPageDto)
  page!: ApplyExtensionPageDto;

  @ApiProperty({ enum: ["apply_user_approved_detections"], example: "apply_user_approved_detections" })
  @IsIn(["apply_user_approved_detections"])
  action!: "apply_user_approved_detections";

  @ApiProperty({ type: [ApplyExtensionTargetDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ApplyExtensionTargetDto)
  approvedTargets!: ApplyExtensionTargetDto[];
}
