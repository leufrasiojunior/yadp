import { Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetQueriesDto } from "./dto/get-queries.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetQuerySuggestionsDto } from "./dto/get-query-suggestions.dto";
import {
  QUERIES_API_OK_RESPONSE,
  QUERY_GROUP_MEMBERSHIP_REFRESH_API_OK_RESPONSE,
  QUERY_SUGGESTIONS_API_OK_RESPONSE,
} from "./queries.responses";
import { QueriesService } from "./queries.service";

@ApiTags("queries")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("queries")
export class QueriesController {
  constructor(@Inject(QueriesService) private readonly queriesService: QueriesService) {}

  @Get()
  @ApiOkResponse(QUERIES_API_OK_RESPONSE)
  getQueries(@Query() query: GetQueriesDto, @Req() request: Request) {
    return this.queriesService.getQueries(query, request);
  }

  @Get("suggestions")
  @ApiOkResponse(QUERY_SUGGESTIONS_API_OK_RESPONSE)
  getQuerySuggestions(@Query() query: GetQuerySuggestionsDto, @Req() request: Request) {
    return this.queriesService.getQuerySuggestions(query, request);
  }

  @Post("group-memberships/refresh")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(QUERY_GROUP_MEMBERSHIP_REFRESH_API_OK_RESPONSE)
  refreshGroupMemberships(@Req() request: Request) {
    return this.queriesService.refreshGroupMemberships(request);
  }
}
