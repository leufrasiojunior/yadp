import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { BatchDeleteGroupsDto } from "./dto/batch-delete-groups.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateGroupsDto } from "./dto/create-groups.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GroupNameParamsDto } from "./dto/group-name-params.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { SyncGroupsDto } from "./dto/sync-groups.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateGroupDto } from "./dto/update-group.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateGroupStatusDto } from "./dto/update-group-status.dto";
import {
  BATCH_DELETE_GROUPS_API_BODY,
  CREATE_GROUPS_API_BODY,
  GROUPS_LIST_API_OK_RESPONSE,
  GROUPS_MUTATION_API_OK_RESPONSE,
  SYNC_GROUPS_API_BODY,
  UPDATE_GROUP_API_BODY,
  UPDATE_GROUP_STATUS_API_BODY,
} from "./groups.responses";
import { GroupsService } from "./groups.service";

@ApiTags("groups")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("groups")
export class GroupsController {
  private static readonly GROUP_NAME_PARAM = {
    name: "name",
    schema: {
      type: "string",
    },
    example: "AD_Unblock",
  } as const;

  constructor(@Inject(GroupsService) private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOkResponse(GROUPS_LIST_API_OK_RESPONSE)
  listGroups(@Req() request: Request) {
    return this.groupsService.listGroups(request);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiBody(CREATE_GROUPS_API_BODY)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  createGroups(@Body() body: CreateGroupsDto, @Req() request: Request) {
    return this.groupsService.createGroups(body, request);
  }

  @Put(":name")
  @UseGuards(CsrfGuard)
  @ApiParam(GroupsController.GROUP_NAME_PARAM)
  @ApiBody(UPDATE_GROUP_API_BODY)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  updateGroup(@Param() params: GroupNameParamsDto, @Body() body: UpdateGroupDto, @Req() request: Request) {
    return this.groupsService.updateGroup(params.name, body, request);
  }

  @Patch(":name/status")
  @UseGuards(CsrfGuard)
  @ApiParam(GroupsController.GROUP_NAME_PARAM)
  @ApiBody(UPDATE_GROUP_STATUS_API_BODY)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  updateGroupStatus(@Param() params: GroupNameParamsDto, @Body() body: UpdateGroupStatusDto, @Req() request: Request) {
    return this.groupsService.updateGroupStatus(params.name, body, request);
  }

  @Delete(":name")
  @UseGuards(CsrfGuard)
  @ApiParam(GroupsController.GROUP_NAME_PARAM)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  deleteGroup(@Param() params: GroupNameParamsDto, @Req() request: Request) {
    return this.groupsService.deleteGroup(params.name, request);
  }

  @Post("batchDelete")
  @UseGuards(CsrfGuard)
  @ApiBody(BATCH_DELETE_GROUPS_API_BODY)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  batchDeleteGroups(@Body() body: BatchDeleteGroupsDto, @Req() request: Request) {
    return this.groupsService.batchDeleteGroups(body, request);
  }

  @Post("sync")
  @UseGuards(CsrfGuard)
  @ApiBody(SYNC_GROUPS_API_BODY)
  @ApiOkResponse(GROUPS_MUTATION_API_OK_RESPONSE)
  syncGroups(@Body() body: SyncGroupsDto, @Req() request: Request) {
    return this.groupsService.syncGroups(body, request);
  }
}
