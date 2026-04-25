import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class SyncConfigTopicDto {
  @ApiProperty({
    description: "Source instance ID used as the canonical topic origin.",
    example: "clz-baseline",
  })
  @IsString()
  sourceInstanceId!: string;

  @ApiProperty({
    description: "Target instance IDs that should receive the topic configuration.",
    example: ["clz-secondary-a", "clz-secondary-b"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetInstanceIds!: string[];
}
