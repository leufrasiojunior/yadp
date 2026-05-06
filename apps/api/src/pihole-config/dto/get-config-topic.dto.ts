import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class GetConfigTopicDto {
  @ApiProperty({
    description: "Optional source instance to read the topic from.",
    example: "clz-baseline",
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceInstanceId?: string;
}
