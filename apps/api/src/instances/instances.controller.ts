import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import type { CreateInstanceDto } from "./dto/create-instance.dto";
import type { DiscoverInstancesDto } from "./dto/discover-instances.dto";
import type { UpdateInstanceDto } from "./dto/update-instance.dto";
import { InstancesService } from "./instances.service";

@ApiTags("instances")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("instances")
export class InstancesController {
  constructor(@Inject(InstancesService) private readonly instancesService: InstancesService) {}

  @Get()
  @ApiOkResponse()
  listInstances() {
    return this.instancesService.listInstances();
  }

  @Post("discover")
  @UseGuards(CsrfGuard)
  @ApiOkResponse()
  discoverInstances(@Body() body: DiscoverInstancesDto, @Req() request: Request) {
    return this.instancesService.discoverInstances(body, request);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiOkResponse()
  createInstance(@Body() body: CreateInstanceDto, @Req() request: Request) {
    return this.instancesService.createInstance(body, request);
  }

  @Post(":id/test")
  @UseGuards(CsrfGuard)
  @ApiOkResponse()
  testInstance(@Param("id") instanceId: string, @Req() request: Request) {
    return this.instancesService.testInstance(instanceId, request);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  @ApiOkResponse()
  updateInstance(@Param("id") instanceId: string, @Body() body: UpdateInstanceDto, @Req() request: Request) {
    return this.instancesService.updateInstance(instanceId, body, request);
  }
}
