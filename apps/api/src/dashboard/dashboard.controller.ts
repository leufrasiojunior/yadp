import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { SessionGuard } from "../session/session.guard";
import { DASHBOARD_OVERVIEW_API_OK_RESPONSE } from "./dashboard.responses";
import { DashboardService } from "./dashboard.service";
import type { GetDashboardOverviewDto } from "./dto/get-dashboard-overview.dto";

@ApiTags("dashboard")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @ApiOkResponse(DASHBOARD_OVERVIEW_API_OK_RESPONSE)
  getOverview(@Query() query: GetDashboardOverviewDto, @Req() request: Request) {
    return this.dashboardService.getOverview(query, request);
  }
}
