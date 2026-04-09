import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import {
  DOMAIN_OPERATION_API_OK_RESPONSE,
  DOMAINS_LIST_API_OK_RESPONSE,
  DOMAINS_MUTATION_API_OK_RESPONSE,
} from "./domains.responses";
import { DomainsService } from "./domains.service";
import type { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
import type { BatchDeleteDomainsDto } from "./dto/batch-delete-domains.dto";
import type { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";
import type { SyncDomainsDto } from "./dto/sync-domains.dto";
import type { UpdateDomainDto } from "./dto/update-domain.dto";

@ApiTags("domains")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("domains")
export class DomainsController {
  constructor(@Inject(DomainsService) private readonly domainsService: DomainsService) {}

  @Get()
  @ApiOkResponse(DOMAINS_LIST_API_OK_RESPONSE)
  listDomains(@Req() request: Request) {
    return this.domainsService.listDomains(request);
  }

  @Post(":type/:kind")
  @UseGuards(CsrfGuard)
  @ApiParam({ name: "type", enum: ["allow", "deny"] })
  @ApiParam({ name: "kind", enum: ["exact", "regex"] })
  @ApiOkResponse(DOMAIN_OPERATION_API_OK_RESPONSE)
  applyDomainOperation(
    @Param() params: DomainOperationParamsDto,
    @Body() body: ApplyDomainOperationDto,
    @Req() request: Request,
  ) {
    return this.domainsService.applyDomainOperation(params, body, request);
  }

  @Put(":domain/:type/:kind")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(DOMAINS_MUTATION_API_OK_RESPONSE)
  updateDomain(
    @Param("domain") domain: string,
    @Param("type") type: string,
    @Param("kind") kind: string,
    @Body() body: UpdateDomainDto,
    @Req() request: Request,
  ) {
    return this.domainsService.updateDomain(domain, type, kind, body, request);
  }

  @Post("batchDelete")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(DOMAINS_MUTATION_API_OK_RESPONSE)
  batchDelete(@Body() body: BatchDeleteDomainsDto, @Req() request: Request) {
    return this.domainsService.batchDelete(body, request);
  }

  @Post("sync")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(DOMAINS_MUTATION_API_OK_RESPONSE)
  syncDomains(@Body() body: SyncDomainsDto, @Req() request: Request) {
    return this.domainsService.syncDomains(body, request);
  }
}
