import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateDomainDto {
  @ApiProperty({
    description: "Comment describing the domain",
    example: "Some comment for this domain",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  comment?: string | null;

  @ApiProperty({
    description: "Groups assigned to this domain",
    type: [Number],
    example: [0],
  })
  @IsNumber({}, { each: true })
  groups!: number[];

  @ApiProperty({
    description: "Whether the domain is enabled",
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;
}
