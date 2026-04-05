import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsString, ValidateNested } from "class-validator";

import type { PiholeListType } from "../../pihole/pihole.types";

class BatchDeleteListItemDto {
  @ApiProperty({
    description: "Address of the list to delete",
    example: "http://teste.com",
  })
  @IsString()
  item!: string;

  @ApiProperty({
    description: "Type of the list to delete",
    enum: ["allow", "block"],
    example: "allow",
  })
  @IsEnum(["allow", "block"])
  type!: PiholeListType;
}

export class BatchDeleteListsDto {
  @ApiProperty({
    description: "Items to delete",
    type: [BatchDeleteListItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDeleteListItemDto)
  items!: BatchDeleteListItemDto[];
}
