import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";

import {
  DOMAIN_OPERATION_KINDS,
  DOMAIN_OPERATION_TYPES,
  type DomainOperationKind,
  type DomainOperationType,
} from "../domains.types";

export class DomainItemParamsDto {
  @ApiProperty({
    description: "Domain or regex pattern (URL encoded if needed)",
    example: "example.com",
  })
  @IsString()
  domain!: string;

  @ApiProperty({ enum: DOMAIN_OPERATION_TYPES })
  @IsIn(DOMAIN_OPERATION_TYPES)
  type!: DomainOperationType;

  @ApiProperty({ enum: DOMAIN_OPERATION_KINDS })
  @IsIn(DOMAIN_OPERATION_KINDS)
  kind!: DomainOperationKind;
}
