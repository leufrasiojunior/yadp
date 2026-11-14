import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import { ApplySubnetDto, SubnetPlanDto } from "./dto/subnet-plan.dto";
import { SUBNET_APPLY_RESPONSE, SUBNET_LIST_RESPONSE, SUBNET_PLAN_RESPONSE } from "./subnets.responses";
import { SubnetsService } from "./subnets.service";

@ApiTags("clients")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("clients/subnets")
export class SubnetsController {
  constructor(@Inject(SubnetsService) private readonly subnets: SubnetsService) {}

  @Get()
  @ApiOkResponse(SUBNET_LIST_RESPONSE)
  @ApiOperation({ summary: "List IPv4/IPv6 subnet policies across sync-enabled Pi-holes" })
  list(@Req() request: Request) {
    return this.subnets.list(request);
  }

  @Post("preview")
  @HttpCode(200)
  @ApiBody({ type: SubnetPlanDto })
  @ApiOkResponse(SUBNET_PLAN_RESPONSE)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Preview subnet creation, update or deletion without writing configuration" })
  preview(@Body() dto: SubnetPlanDto, @Req() request: Request) {
    return this.subnets.preview(dto, request);
  }

  @Post("apply")
  @HttpCode(200)
  @ApiBody({ type: ApplySubnetDto })
  @ApiOkResponse(SUBNET_APPLY_RESPONSE)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Apply a reviewed subnet plan, with drift checks and per-instance results" })
  apply(@Body() dto: ApplySubnetDto, @Req() request: Request) {
    return this.subnets.apply(dto, request);
  }
}
