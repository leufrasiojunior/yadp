import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { BatchDeleteListsDto } from "./dto/batch-delete-lists.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateListDto } from "./dto/create-list.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ListAddressParamsDto } from "./dto/list-address-params.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { SyncListsDto } from "./dto/sync-lists.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { UpdateListDto } from "./dto/update-list.dto";
import { LISTS_LIST_API_OK_RESPONSE, LISTS_MUTATION_API_OK_RESPONSE, UPDATE_LIST_API_BODY } from "./lists.responses";
import { ListsService } from "./lists.service";

@ApiTags("lists")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("lists")
export class ListsController {
  private static readonly LIST_ADDRESS_PARAM = {
    name: "address",
    schema: {
      type: "string",
    },
    example: "https%3A%2F%2Fraw.githubusercontent.com%2FStevenBlack%2Fhosts%2Fmaster%2Fhosts",
  } as const;

  constructor(@Inject(ListsService) private readonly listsService: ListsService) {}

  @Get()
  @ApiOkResponse(LISTS_LIST_API_OK_RESPONSE)
  listLists(@Req() request: Request) {
    return this.listsService.listLists(request);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiOkResponse(LISTS_MUTATION_API_OK_RESPONSE)
  createList(@Body() body: CreateListDto, @Req() request: Request) {
    return this.listsService.createList(body, request);
  }

  @Put(":address")
  @UseGuards(CsrfGuard)
  @ApiParam(ListsController.LIST_ADDRESS_PARAM)
  @ApiBody(UPDATE_LIST_API_BODY)
  @ApiOkResponse(LISTS_MUTATION_API_OK_RESPONSE)
  updateList(@Param() params: ListAddressParamsDto, @Body() body: UpdateListDto, @Req() request: Request) {
    return this.listsService.updateList(params.address, body, request);
  }

  @Post("batchDelete")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(LISTS_MUTATION_API_OK_RESPONSE)
  batchDelete(@Body() body: BatchDeleteListsDto, @Req() request: Request) {
    return this.listsService.batchDelete(body, request);
  }

  @Post("sync")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(LISTS_MUTATION_API_OK_RESPONSE)
  syncLists(@Body() body: SyncListsDto, @Req() request: Request) {
    return this.listsService.syncLists(body, request);
  }
}
