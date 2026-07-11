import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import {
  BrowserExtensionApplyResponse,
  BrowserExtensionConfigResponseClass,
  BrowserExtensionDetectionsResponse,
  BrowserExtensionDeviceRevokeResponse,
  BrowserExtensionDevicesResponse,
  BrowserExtensionDomainDetectionsResponse,
  BrowserExtensionPairingCodeResponse,
  BrowserExtensionPairResponse,
  BrowserExtensionReportResponse,
  BrowserExtensionSettingsResponse,
  BrowserExtensionUndoResponse,
} from "./browser-extension.responses";
import { BrowserExtensionService } from "./browser-extension.service";
import { type BrowserExtensionAuthenticatedRequest, BrowserExtensionAuthGuard } from "./browser-extension-auth.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ApplyExtensionDetectionsDto } from "./dto/apply-extension-detections.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreatePairingCodeDto } from "./dto/create-pairing-code.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetExtensionDetectionsDto } from "./dto/get-extension-detections.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { PairExtensionDto } from "./dto/pair-extension.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ReportExtensionDetectionsDto } from "./dto/report-extension-detections.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UndoExtensionBatchDto } from "./dto/undo-extension-batch.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateExtensionSettingsDto } from "./dto/update-extension-settings.dto";

@ApiTags("browser-extension")
@Controller("browser-extension")
export class BrowserExtensionController {
  constructor(@Inject(BrowserExtensionService) private readonly service: BrowserExtensionService) {}

  @Post("pairing-codes")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionPairingCodeResponse })
  createPairingCode(@Body() _body: CreatePairingCodeDto, @Req() request: Request) {
    return this.service.createPairingCode(request);
  }

  @Post("pair")
  @ApiOkResponse({ type: BrowserExtensionPairResponse })
  pairExtension(@Body() body: PairExtensionDto, @Req() request: Request) {
    return this.service.pairExtension(body, request);
  }

  @Get("config")
  @UseGuards(BrowserExtensionAuthGuard)
  @ApiBearerAuth("browser_extension")
  @ApiOkResponse({ type: BrowserExtensionConfigResponseClass })
  getConfig(@Req() _request: BrowserExtensionAuthenticatedRequest) {
    return this.service.getConfig();
  }

  @Patch("settings")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionSettingsResponse })
  updateSettings(@Body() body: UpdateExtensionSettingsDto, @Req() request: Request) {
    return this.service.updateSettings(body, request);
  }

  @Get("settings")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionSettingsResponse })
  getSettings() {
    return this.service.getSettings();
  }

  @Post("detections/apply")
  @UseGuards(BrowserExtensionAuthGuard)
  @ApiBearerAuth("browser_extension")
  @ApiOkResponse({ type: BrowserExtensionApplyResponse })
  applyDetections(@Body() body: ApplyExtensionDetectionsDto, @Req() request: BrowserExtensionAuthenticatedRequest) {
    return this.service.applyDetections(body, request);
  }

  @Post("detections/report")
  @UseGuards(BrowserExtensionAuthGuard)
  @ApiBearerAuth("browser_extension")
  @ApiOkResponse({ type: BrowserExtensionReportResponse })
  reportDetections(@Body() body: ReportExtensionDetectionsDto, @Req() request: BrowserExtensionAuthenticatedRequest) {
    return this.service.reportDetections(body, request);
  }

  @Post("detections/undo-last")
  @UseGuards(BrowserExtensionAuthGuard)
  @ApiBearerAuth("browser_extension")
  @ApiOkResponse({ type: BrowserExtensionUndoResponse })
  undoLast(@Body() body: UndoExtensionBatchDto, @Req() request: BrowserExtensionAuthenticatedRequest) {
    return this.service.undoLast(body, request);
  }

  @Get("detections")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionDetectionsResponse })
  listDetections(@Query() query: GetExtensionDetectionsDto) {
    return this.service.listDetections(query);
  }

  @Get("detections/domains")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionDomainDetectionsResponse })
  listDomainDetections(@Query() query: GetExtensionDetectionsDto) {
    return this.service.listDomainDetections(query);
  }

  @Get("devices")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionDevicesResponse })
  listDevices() {
    return this.service.listDevices();
  }

  @Post("devices/:id/revoke")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: BrowserExtensionDeviceRevokeResponse })
  revokeDevice(@Param("id") id: string, @Req() request: Request) {
    return this.service.revokeDevice(id, request);
  }
}
