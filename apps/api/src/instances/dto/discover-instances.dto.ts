import { ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl } from "class-validator";

export class DiscoverInstancesDto {
  @ApiPropertyOptional({
    type: [String],
    example: ["https://pi.hole", "https://pihole.lan"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] }, { each: true })
  candidates?: string[];
}
