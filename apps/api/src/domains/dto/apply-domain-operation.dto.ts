import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

import { DOMAIN_SCOPE_VALUES, type DomainScopeMode } from "../domains.types";

export class ApplyDomainOperationDto {
  @ApiProperty({
    description: "Domain or regex pattern",
    example: "example.com",
  })
  @IsString()
  domain!: string;

  @ApiProperty({
    description: "Comment describing why the operation is applied",
    example: "Blocked for parental control",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  comment?: string | null;

  @ApiProperty({
    description: "Operation scope",
    enum: DOMAIN_SCOPE_VALUES,
    example: "all",
  })
  @IsEnum(DOMAIN_SCOPE_VALUES)
  scope!: DomainScopeMode;

  @ApiProperty({
    description: "Specific instance ID when scope is set to 'instance'",
    example: "clz-baseline",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  instanceId?: string | null;

  @ApiProperty({
    description: "Groups assigned to this domain",
    type: [Number],
    example: [0],
    required: false,
  })
  @IsNumber({}, { each: true })
  @IsOptional()
  groups?: number[];
}
