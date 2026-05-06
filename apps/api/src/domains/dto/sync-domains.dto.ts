import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class SyncDomainsDto {
  @ApiProperty({
    description: "Domain or regex pattern to sync",
    example: "example.com",
    required: false,
  })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiProperty({
    description: "Type of the domain list entry",
    enum: ["allow", "deny"],
    example: "allow",
    required: false,
  })
  @IsEnum(["allow", "deny"])
  @IsOptional()
  type?: "allow" | "deny";

  @ApiProperty({
    description: "Kind of the domain entry",
    enum: ["exact", "regex"],
    example: "exact",
    required: false,
  })
  @IsEnum(["exact", "regex"])
  @IsOptional()
  kind?: "exact" | "regex";

  @ApiProperty({
    description: "ID of the source instance to copy from",
    example: "clz-baseline",
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceInstanceId?: string;

  @ApiProperty({
    description: "IDs of the target instances to sync to",
    example: ["clz-secondary-a", "clz-secondary-b"],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetInstanceIds?: string[];
}
