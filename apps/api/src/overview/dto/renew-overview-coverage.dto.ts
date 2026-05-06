import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class RenewOverviewCoverageDto {
  @ApiProperty({ example: "cmabc123overviewcoverage" })
  @IsString()
  @MaxLength(191)
  coverageWindowId!: string;
}
