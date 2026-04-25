import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class DeleteConfigIgnoreRuleParamsDto {
  @ApiProperty({
    example: "webserver",
  })
  @IsString()
  topic!: string;

  @ApiProperty({
    example: "api.headers",
  })
  @IsString()
  fieldPath!: string;
}
