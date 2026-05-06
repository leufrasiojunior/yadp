import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class SyncListsDto {
  @ApiProperty({
    description: "Address of the list to sync (optional, if omitted syncs all)",
    example: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: "Type of the list to sync (required if address is provided)",
    enum: ["allow", "block"],
    example: "block",
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: "allow" | "block";

  @ApiProperty({
    description: "ID of the source instance to copy the list from (optional if address is omitted)",
    example: "clz-baseline",
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceInstanceId?: string;

  @ApiProperty({
    description: "IDs of the target instances to sync the list to (optional if address is omitted)",
    example: ["clz-secondary-a", "clz-secondary-b"],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetInstanceIds?: string[];
}
