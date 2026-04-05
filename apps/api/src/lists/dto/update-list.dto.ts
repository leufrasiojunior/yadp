import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

import type { PiholeListType } from "../../pihole/pihole.types";

export class UpdateListDto {
  @ApiProperty({
    description: "Comment describing the list",
    example: "Some comment for this list",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  comment?: string | null;

  @ApiProperty({
    description: "Type of list",
    enum: ["allow", "block"],
    example: "block",
  })
  @IsEnum(["allow", "block"])
  type!: PiholeListType;

  @ApiProperty({
    description: "Groups assigned to this list",
    type: [Number],
    example: [0],
  })
  @IsNumber({}, { each: true })
  groups!: number[];

  @ApiProperty({
    description: "Whether the list is enabled",
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;
}
