import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

import {
  DOMAIN_PATTERN_MODE_VALUES,
  DOMAIN_SCOPE_VALUES,
  type DomainPatternMode,
  type DomainScopeMode,
} from "../domains.types";

export class ApplyDomainOperationDto {
  @ApiProperty({
    description: "Domain or regex pattern",
    example: "example.com",
  })
  @IsString()
  domain!: string;

  @ApiPropertyOptional({
    description: "Comment describing why the operation is applied",
    example: "Blocked for parental control",
    nullable: true,
  })
  @IsString()
  @IsOptional()
  comment?: string | null;

  @ApiPropertyOptional({
    description: "Operation scope",
    enum: DOMAIN_SCOPE_VALUES,
    default: "all",
    example: "all",
  })
  @Transform(({ value }) => value ?? "all")
  @IsIn(DOMAIN_SCOPE_VALUES)
  @IsOptional()
  scope: DomainScopeMode = "all";

  @ApiPropertyOptional({
    description: "Specific instance ID when scope is set to 'instance'",
    example: "clz-baseline",
    nullable: true,
  })
  @IsString()
  @IsOptional()
  instanceId?: string | null;

  @ApiPropertyOptional({
    description: "Groups assigned to this domain",
    type: [Number],
    example: [0],
  })
  @IsNumber({}, { each: true })
  @IsOptional()
  groups?: number[];

  @ApiPropertyOptional({
    description: "How the submitted domain should be interpreted before creating the Pi-hole entry",
    enum: DOMAIN_PATTERN_MODE_VALUES,
    example: "regex_specific",
  })
  @IsIn(DOMAIN_PATTERN_MODE_VALUES)
  @IsOptional()
  patternMode?: DomainPatternMode;
}
