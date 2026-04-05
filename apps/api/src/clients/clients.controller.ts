import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import {
  CLIENTS_LIST_API_OK_RESPONSE,
  CLIENTS_MUTATION_API_OK_RESPONSE,
  SAVE_CLIENTS_API_BODY,
  SYNC_CLIENTS_API_BODY,
} from "./clients.responses";
import { ClientsService } from "./clients.service";
import {
  CLIENT_LIST_SORT_DIRECTIONS,
  CLIENT_LIST_SORT_FIELDS,
  DEFAULT_CLIENTS_SORT_DIRECTION,
  DEFAULT_CLIENTS_SORT_FIELD,
} from "./clients.types";
import type { GetClientsDto } from "./dto/get-clients.dto";
import type { SaveClientsDto } from "./dto/save-clients.dto";
import type { SyncClientsDto } from "./dto/sync-clients.dto";

@ApiTags("clients")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("clients")
export class ClientsController {
  constructor(@Inject(ClientsService) private readonly clientsService: ClientsService) {}

  @Get()
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 10 })
  @ApiQuery({ name: "search", required: false, example: "192.168.31.18" })
  @ApiQuery({ name: "excludedTags", required: false, isArray: true, type: String, example: ["IoT"] })
  @ApiQuery({
    name: "sortBy",
    required: false,
    example: DEFAULT_CLIENTS_SORT_FIELD,
    enum: [...CLIENT_LIST_SORT_FIELDS],
  })
  @ApiQuery({
    name: "sortDirection",
    required: false,
    example: DEFAULT_CLIENTS_SORT_DIRECTION,
    enum: [...CLIENT_LIST_SORT_DIRECTIONS],
  })
  @ApiOkResponse(CLIENTS_LIST_API_OK_RESPONSE)
  listClients(@Query() query: GetClientsDto, @Req() request: Request) {
    return this.clientsService.listClients(query, request);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiBody(SAVE_CLIENTS_API_BODY)
  @ApiOkResponse(CLIENTS_MUTATION_API_OK_RESPONSE)
  saveClients(@Body() body: SaveClientsDto, @Req() request: Request) {
    return this.clientsService.saveClients(body, request);
  }

  @Post("sync")
  @UseGuards(CsrfGuard)
  @ApiBody(SYNC_CLIENTS_API_BODY)
  @ApiOkResponse(CLIENTS_MUTATION_API_OK_RESPONSE)
  syncClients(@Body() body: SyncClientsDto, @Req() request: Request) {
    return this.clientsService.syncClients(body, request);
  }
}
