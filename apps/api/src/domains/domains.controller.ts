import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOkResponse, ApiParam, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import {
  DOMAIN_API_OK_RESPONSE,
  DOMAIN_OPERATION_API_OK_RESPONSE,
  DOMAINS_IMPORT_API_BODY,
  DOMAINS_IMPORT_API_OK_RESPONSE,
  DOMAINS_LIST_API_OK_RESPONSE,
  DOMAINS_MUTATION_API_OK_RESPONSE,
} from "./domains.responses";
import { DomainsService } from "./domains.service";
import type { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
import type { BatchDeleteDomainsDto } from "./dto/batch-delete-domains.dto";
import type { DomainItemParamsDto } from "./dto/domain-item-params.dto";
import type { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";
import type { GetDomainsDto } from "./dto/get-domains.dto";
import type { SyncDomainsDto } from "./dto/sync-domains.dto";
import type { UpdateDomainDto } from "./dto/update-domain.dto";

type UploadedCsvFile = {
  buffer: Buffer;
};

@ApiTags("domains")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("domains")
export class DomainsController {
  constructor(@Inject(DomainsService) private readonly domainsService: DomainsService) {}

  @Get()
  @ApiOkResponse(DOMAINS_LIST_API_OK_RESPONSE)
  listDomains(@Query() query: GetDomainsDto, @Req() request: Request) {
    return this.domainsService.listDomains(query, request);
  }

  @Get("export")
  @ApiProduces("text/csv")
  async exportDomains(
    @Query() query: GetDomainsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { filename, content } = await this.domainsService.exportDomainsCsv(query, request);
    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", `attachment; filename="${filename}"`);
    return content;
  }

  @Post("import")
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody(DOMAINS_IMPORT_API_BODY)
  @ApiOkResponse(DOMAINS_IMPORT_API_OK_RESPONSE)
  importDomains(@UploadedFile() file: UploadedCsvFile | undefined, @Req() request: Request) {
    return this.domainsService.importDomainsCsv(file, request);
  }

  @Get(":domain/:type/:kind")
  @ApiOkResponse(DOMAIN_API_OK_RESPONSE)
  getDomain(@Param() params: DomainItemParamsDto, @Req() request: Request) {
    return this.domainsService.getDomain(params, request);
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
