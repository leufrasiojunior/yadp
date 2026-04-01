import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

import {
  DOMAIN_OPERATION_KINDS,
  DOMAIN_OPERATION_TYPES,
  type DomainOperationKind,
  type DomainOperationType,
} from "../domains.types";

export class DomainOperationParamsDto {
  @ApiProperty({ enum: DOMAIN_OPERATION_TYPES })
  @IsIn(DOMAIN_OPERATION_TYPES)
  type!: DomainOperationType;

  @ApiProperty({ enum: DOMAIN_OPERATION_KINDS })
  @IsIn(DOMAIN_OPERATION_KINDS)
  kind!: DomainOperationKind;
}
