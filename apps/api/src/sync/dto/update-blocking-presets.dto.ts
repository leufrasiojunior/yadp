import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min, ValidateNested } from "class-validator";

class UpdateBlockingPresetItemDto {
  @ApiProperty({ example: "50 minutos" })
  @IsString()
  @MaxLength(191)
  name!: string;

  @ApiProperty({ example: 300 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timerSeconds!: number;
}

export class UpdateBlockingPresetsDto {
  @ApiProperty({
    type: [UpdateBlockingPresetItemDto],
    example: [
      { name: "10 segundos", timerSeconds: 10 },
      { name: "30 segundos", timerSeconds: 30 },
      { name: "5 minutos", timerSeconds: 300 },
    ],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpdateBlockingPresetItemDto)
  presets!: UpdateBlockingPresetItemDto[];
}
