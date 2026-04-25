import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateConfigIgnoreRuleDto } from "./dto/create-config-ignore-rule.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { DeleteConfigIgnoreRuleParamsDto } from "./dto/delete-config-ignore-rule-params.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ExportTeleporterDto } from "./dto/export-teleporter.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetConfigTopicDto } from "./dto/get-config-topic.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { SyncConfigTopicDto } from "./dto/sync-config-topic.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateConfigTopicDto } from "./dto/update-config-topic.dto";
import {
  CONFIG_IGNORE_RULE_API_OK_RESPONSE,
  CONFIG_MUTATION_API_OK_RESPONSE,
  CONFIG_OVERVIEW_API_OK_RESPONSE,
  CONFIG_TOPIC_API_OK_RESPONSE,
} from "./pihole-config.responses";
import { PiholeConfigService } from "./pihole-config.service";

@ApiTags("config")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("config")
export class PiholeConfigController {
  constructor(@Inject(PiholeConfigService) private readonly configService: PiholeConfigService) {}

  @Get()
  @ApiOkResponse(CONFIG_OVERVIEW_API_OK_RESPONSE)
  getOverview(@Req() request: Request) {
    return this.configService.getOverview(request);
  }

  @Post("ignored-fields")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(CONFIG_IGNORE_RULE_API_OK_RESPONSE)
  createIgnoreRule(@Body() body: CreateConfigIgnoreRuleDto, @Req() request: Request) {
    return this.configService.createIgnoreRule(body, request);
  }

  @Post("ignored-fields/delete")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(CONFIG_IGNORE_RULE_API_OK_RESPONSE)
  deleteIgnoreRuleLegacy(@Body() body: CreateConfigIgnoreRuleDto, @Req() request: Request) {
    return this.configService.deleteIgnoreRule(body.topic, body.fieldPath, request);
  }

  @Delete("ignored-fields/:topic/:fieldPath")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(CONFIG_IGNORE_RULE_API_OK_RESPONSE)
  deleteIgnoreRule(@Param() params: DeleteConfigIgnoreRuleParamsDto, @Req() request: Request) {
    return this.configService.deleteIgnoreRule(params.topic, params.fieldPath, request);
  }

  @Get("teleporter/export")
  @ApiProduces("application/zip")
  @ApiQuery({ name: "instanceId", required: false, type: String })
  async exportTeleporter(
    @Query() query: ExportTeleporterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exportResult = await this.configService.exportTeleporter(query, request);

    response.setHeader("content-type", exportResult.contentType);
    response.setHeader("content-disposition", `attachment; filename="${exportResult.filename}"`);

    return exportResult.data;
  }

  @Get(":topic")
  @ApiOkResponse(CONFIG_TOPIC_API_OK_RESPONSE)
  getTopic(@Param("topic") topic: string, @Query() query: GetConfigTopicDto, @Req() request: Request) {
    return this.configService.getTopic(topic, query, request);
  }

  @Patch(":topic")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(CONFIG_TOPIC_API_OK_RESPONSE)
  updateTopic(@Param("topic") topic: string, @Body() body: UpdateConfigTopicDto, @Req() request: Request) {
    return this.configService.updateTopic(topic, body, request);
  }

  @Post(":topic/sync")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(CONFIG_MUTATION_API_OK_RESPONSE)
  syncTopic(@Param("topic") topic: string, @Body() body: SyncConfigTopicDto, @Req() request: Request) {
    return this.configService.syncTopic(topic, body, request);
  }
}
