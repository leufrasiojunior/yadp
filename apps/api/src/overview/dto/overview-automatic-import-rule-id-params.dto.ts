import { IsString, MaxLength } from "class-validator";

export class OverviewAutomaticImportRuleIdParamsDto {
  @IsString()
  @MaxLength(191)
  id!: string;
}
