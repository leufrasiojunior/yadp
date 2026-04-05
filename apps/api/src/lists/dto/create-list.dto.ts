import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

import type { PiholeListType } from "../../pihole/pihole.types";

export class CreateListDto {
  @ApiProperty({
    description: "Address of the list",
    example: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
  })
  @IsString()
  address!: string;

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
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
