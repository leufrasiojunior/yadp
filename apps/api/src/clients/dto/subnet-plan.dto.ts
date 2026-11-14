import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class SubnetPlanDto {
  @ApiProperty({ type: String, example: "192.0.2.0/24" })
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  client!: string;

  @ApiProperty({ type: String, enum: ["save", "delete"] })
  @IsIn(["save", "delete"])
  operation!: "save" | "delete";

  @ApiPropertyOptional({ type: [String], example: ["IoT"] })
  @ValidateIf((value: SubnetPlanDto) => value.operation === "save" || value.groups !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  groups?: string[];

  @ApiPropertyOptional({ type: String, example: "IoT subnet policy" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: "Omit to target all sync-enabled instances." })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  targetInstanceIds?: string[];
}

export class ApplySubnetDto extends SubnetPlanDto {
  @ApiProperty({ type: String, description: "Configuration fingerprint returned by the preview endpoint." })
  @Matches(/^[a-f0-9]{64}$/)
  previewToken!: string;
}
