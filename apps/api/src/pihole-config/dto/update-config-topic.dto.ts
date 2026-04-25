import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateConfigTopicDto {
  @ApiProperty({
    description: "Optional source instance to update. Defaults to the baseline.",
    example: "clz-baseline",
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceInstanceId?: string;

  @ApiProperty({
    description: "Topic-scoped Pi-hole config patch payload.",
    example: {
      config: {
        dns: {
          queryLogging: true,
        },
      },
    },
  })
  @IsObject()
  config!: Record<string, unknown>;
}
