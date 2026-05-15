import { PartialType } from "@nestjs/swagger";

import { CreateOverviewAutomaticImportRuleDto } from "./create-overview-automatic-import-rule.dto";

export class UpdateOverviewAutomaticImportRuleDto extends PartialType(CreateOverviewAutomaticImportRuleDto) {}
