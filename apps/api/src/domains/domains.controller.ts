import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import { DOMAIN_OPERATION_API_OK_RESPONSE } from "./domains.responses";
import { DomainsService } from "./domains.service";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";

@ApiTags("domains")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("domains")
export class DomainsController {
  constructor(@Inject(DomainsService) private readonly domainsService: DomainsService) {}

  @Post(":type/:kind")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(DOMAIN_OPERATION_API_OK_RESPONSE)
  applyDomainOperation(
    @Param() params: DomainOperationParamsDto,
    @Body() body: ApplyDomainOperationDto,
    @Req() request: Request,
  ) {
    return this.domainsService.applyDomainOperation(params, body, request);
  }
}
