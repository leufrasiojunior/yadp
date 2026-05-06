import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsString, ValidateNested } from "class-validator";

class BatchDeleteDomainItemDto {
  @ApiProperty({
    description: "Domain or regex pattern to delete",
    example: "example.com",
  })
  @IsString()
  item!: string;

  @ApiProperty({
    description: "Type of the domain list entry",
    enum: ["allow", "deny"],
    example: "allow",
  })
  @IsEnum(["allow", "deny"])
  type!: "allow" | "deny";

  @ApiProperty({
    description: "Kind of the domain entry",
    enum: ["exact", "regex"],
    example: "exact",
  })
  @IsEnum(["exact", "regex"])
  kind!: "exact" | "regex";
}

export class BatchDeleteDomainsDto {
  @ApiProperty({
    description: "Items to delete",
    type: [BatchDeleteDomainItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDeleteDomainItemDto)
  items!: BatchDeleteDomainItemDto[];
}
