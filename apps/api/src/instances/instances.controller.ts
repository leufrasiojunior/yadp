import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateInstanceDto } from "./dto/create-instance.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { DiscoverInstancesDto } from "./dto/discover-instances.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { InstanceIdParamsDto } from "./dto/instance-id-params.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateInstanceDto } from "./dto/update-instance.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateInstanceSyncDto } from "./dto/update-instance-sync.dto";
import {
  CREATE_INSTANCE_API_BODY,
  DISCOVER_INSTANCES_API_BODY,
  INSTANCE_DETAIL_API_OK_RESPONSE,
  INSTANCE_MUTATION_API_OK_RESPONSE,
  INSTANCE_REAUTHENTICATE_API_OK_RESPONSE,
  INSTANCE_SYNC_MUTATION_API_OK_RESPONSE,
  INSTANCE_TEST_API_OK_RESPONSE,
  INSTANCES_DISCOVER_API_OK_RESPONSE,
  INSTANCES_LIST_API_OK_RESPONSE,
  UPDATE_INSTANCE_API_BODY,
  UPDATE_INSTANCE_SYNC_API_BODY,
} from "./instances.responses";
import { InstancesService } from "./instances.service";

@ApiTags("instances")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("instances")
export class InstancesController {
  private static readonly INSTANCE_ID_PARAM = {
    name: "id",
    schema: {
      type: "string",
    },
    example: "clw5i2x560001szyf2c4qz7cf",
  } as const;

  private readonly instancesService: InstancesService;

  constructor(@Inject(InstancesService) instancesService: InstancesService) {
    this.instancesService = instancesService;
  }

  @Get()
  @ApiOkResponse(INSTANCES_LIST_API_OK_RESPONSE)
  listInstances() {
    return this.instancesService.listInstances();
  }

  @Get(":id")
  @ApiParam(InstancesController.INSTANCE_ID_PARAM)
  @ApiOkResponse(INSTANCE_DETAIL_API_OK_RESPONSE)
  getInstance(@Param() params: InstanceIdParamsDto, @Req() request: Request) {
    return this.instancesService.getInstance(params.id, request);
  }

  @Post("discover")
  @UseGuards(CsrfGuard)
  @ApiBody(DISCOVER_INSTANCES_API_BODY)
  @ApiOkResponse(INSTANCES_DISCOVER_API_OK_RESPONSE)
  discoverInstances(@Body() body: DiscoverInstancesDto, @Req() request: Request) {
    return this.instancesService.discoverInstances(body, request);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiBody(CREATE_INSTANCE_API_BODY)
  @ApiOkResponse(INSTANCE_MUTATION_API_OK_RESPONSE)
  createInstance(@Body() body: CreateInstanceDto, @Req() request: Request) {
    return this.instancesService.createInstance(body, request);
  }

  @Post(":id/test")
  @UseGuards(CsrfGuard)
  @ApiParam(InstancesController.INSTANCE_ID_PARAM)
  @ApiOkResponse(INSTANCE_TEST_API_OK_RESPONSE)
  testInstance(@Param() params: InstanceIdParamsDto, @Req() request: Request) {
    return this.instancesService.testInstance(params.id, request);
  }

  @Post(":id/reauthenticate")
  @UseGuards(CsrfGuard)
  @ApiParam(InstancesController.INSTANCE_ID_PARAM)
  @ApiOkResponse(INSTANCE_REAUTHENTICATE_API_OK_RESPONSE)
  reauthenticateInstance(@Param() params: InstanceIdParamsDto, @Req() request: Request) {
    return this.instancesService.reauthenticateInstance(params.id, request);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  @ApiParam(InstancesController.INSTANCE_ID_PARAM)
  @ApiBody(UPDATE_INSTANCE_API_BODY)
  @ApiOkResponse(INSTANCE_MUTATION_API_OK_RESPONSE)
  updateInstance(@Param() params: InstanceIdParamsDto, @Body() body: UpdateInstanceDto, @Req() request: Request) {
    return this.instancesService.updateInstance(params.id, body, request);
  }

  @Patch(":id/sync")
  @UseGuards(CsrfGuard)
  @ApiParam(InstancesController.INSTANCE_ID_PARAM)
  @ApiBody(UPDATE_INSTANCE_SYNC_API_BODY)
  @ApiOkResponse(INSTANCE_SYNC_MUTATION_API_OK_RESPONSE)
  updateInstanceSync(
    @Param() params: InstanceIdParamsDto,
    @Body() body: UpdateInstanceSyncDto,
    @Req() request: Request,
  ) {
    return this.instancesService.updateInstanceSync(params.id, body, request);
  }
}
