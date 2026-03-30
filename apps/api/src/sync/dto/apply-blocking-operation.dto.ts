import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ApplyBlockingOperationDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  blocking!: boolean;

  @ApiPropertyOptional({ example: 300, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timerSeconds?: number | null;

  @ApiProperty({ example: ["clw5i2x560001szyf2c4qz7cf"] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  targetInstanceIds!: string[];
}
