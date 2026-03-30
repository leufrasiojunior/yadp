import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class PreviewBlockingOperationDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  blocking!: boolean;

  @ApiPropertyOptional({ example: 300, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timerSeconds?: number | null;
}
