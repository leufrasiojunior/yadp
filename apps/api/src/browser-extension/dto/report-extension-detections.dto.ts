import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

import { BROWSER_EXTENSION_RISK_LEVEL_VALUES, type BrowserExtensionRiskLevel } from "../browser-extension.types";
import {
  ApplyExtensionEvidenceDto,
  ApplyExtensionMetadataDto,
  ApplyExtensionPageDto,
} from "./apply-extension-detections.dto";

class ReportExtensionTargetDto {
  @ApiProperty({ example: "candidate-1" })
  @IsString()
  @MaxLength(120)
  candidateId!: string;

  @ApiProperty({ example: "ads.example.net" })
  @IsString()
  @MaxLength(253)
  target!: string;

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

export class ReportExtensionDetectionsDto {
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

  @ApiProperty({ type: ApplyExtensionPageDto })
  @ValidateNested()
  @Type(() => ApplyExtensionPageDto)
  page!: ApplyExtensionPageDto;

  @ApiProperty({ enum: ["report_detected_items"], example: "report_detected_items" })
  @IsIn(["report_detected_items"])
  action!: "report_detected_items";

  @ApiProperty({ type: [ReportExtensionTargetDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReportExtensionTargetDto)
  detectedTargets!: ReportExtensionTargetDto[];
}
