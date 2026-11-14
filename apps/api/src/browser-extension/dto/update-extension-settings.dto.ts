import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateExtensionSettingsDto {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  sendPageTitle?: boolean;

  @ApiPropertyOptional({ type: [String], example: ["*://bank.example/*"] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  hardBlockedUrlPatterns?: string[];

  @ApiPropertyOptional({ type: [String], example: ["*://*/checkout/*"] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  sensitiveUrlPatterns?: string[];
}
