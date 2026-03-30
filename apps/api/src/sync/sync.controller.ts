import { Body, Controller, Get, Inject, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import type { ApplyBlockingOperationDto } from "./dto/apply-blocking-operation.dto";
import type { PreviewBlockingOperationDto } from "./dto/preview-blocking-operation.dto";
import type { UpdateBlockingPresetsDto } from "./dto/update-blocking-presets.dto";
import {
  SYNC_BLOCKING_APPLY_API_OK_RESPONSE,
  SYNC_BLOCKING_PRESET_API_OK_RESPONSE,
  SYNC_BLOCKING_PREVIEW_API_OK_RESPONSE,
  SYNC_BLOCKING_STATUS_API_OK_RESPONSE,
} from "./sync.responses";
import { SyncService } from "./sync.service";

@ApiTags("sync")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Get("operations/blocking")
  @ApiOkResponse(SYNC_BLOCKING_STATUS_API_OK_RESPONSE)
  getBlockingStatus(@Req() request: Request) {
    return this.syncService.getBlockingStatus(request);
  }

  @Put("operations/blocking/presets")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(SYNC_BLOCKING_PRESET_API_OK_RESPONSE)
  updateBlockingPresets(@Body() body: UpdateBlockingPresetsDto, @Req() request: Request) {
    return this.syncService.updateBlockingPresets(body, request);
  }

  @Post("operations/blocking/preview")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(SYNC_BLOCKING_PREVIEW_API_OK_RESPONSE)
  previewBlocking(@Body() body: PreviewBlockingOperationDto, @Req() request: Request) {
    return this.syncService.previewBlocking(body, request);
  }

  @Post("operations/blocking/apply")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(SYNC_BLOCKING_APPLY_API_OK_RESPONSE)
  applyBlocking(@Body() body: ApplyBlockingOperationDto, @Req() request: Request) {
    return this.syncService.applyBlocking(body, request);
  }
}
