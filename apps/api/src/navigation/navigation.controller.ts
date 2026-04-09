import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { SessionGuard } from "../session/session.guard";
import { NAVIGATION_SUMMARY_API_OK_RESPONSE } from "./navigation.responses";
import { NavigationService } from "./navigation.service";

@ApiTags("navigation")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("navigation")
export class NavigationController {
  constructor(@Inject(NavigationService) private readonly navigationService: NavigationService) {}

  @Get("summary")
  @ApiOkResponse(NAVIGATION_SUMMARY_API_OK_RESPONSE)
  getSummary(@Req() request: Request) {
    return this.navigationService.getSummary(request);
  }
}
