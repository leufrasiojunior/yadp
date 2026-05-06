import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateOverviewHistoryJobDto } from "./dto/create-overview-history-job.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetOverviewDto } from "./dto/get-overview.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { GetOverviewJobsDto } from "./dto/get-overview-jobs.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { OverviewJobIdParamsDto } from "./dto/overview-job-id-params.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { RenewOverviewCoverageDto } from "./dto/renew-overview-coverage.dto";
import {
  OVERVIEW_API_OK_RESPONSE,
  OVERVIEW_COVERAGE_RENEW_API_OK_RESPONSE,
  OVERVIEW_JOB_DETAILS_API_OK_RESPONSE,
  OVERVIEW_JOB_MUTATION_API_OK_RESPONSE,
  OVERVIEW_JOBS_API_OK_RESPONSE,
} from "./overview.responses";
import { OverviewService } from "./overview.service";

@ApiTags("overview")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("overview")
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overviewService: OverviewService) {}

  @Get()
  @ApiOkResponse(OVERVIEW_API_OK_RESPONSE)
  getOverview(@Query() query: GetOverviewDto, @Req() request: Request) {
    return this.overviewService.getOverview(query, request);
  }

  @Get("jobs")
  @ApiOkResponse(OVERVIEW_JOBS_API_OK_RESPONSE)
  getJobs(@Query() query: GetOverviewJobsDto) {
    return this.overviewService.listJobs(query);
  }

  @Get("jobs/:id/details")
  @ApiOkResponse(OVERVIEW_JOB_DETAILS_API_OK_RESPONSE)
  getJobDetails(@Param() params: OverviewJobIdParamsDto) {
    return this.overviewService.getJobDetails(params.id);
  }

  @Post("backfill")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(OVERVIEW_JOB_MUTATION_API_OK_RESPONSE)
  createBackfill(@Body() body: CreateOverviewHistoryJobDto, @Req() request: Request) {
    return this.overviewService.enqueueManualImport(body, request);
  }

  @Post("delete")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(OVERVIEW_JOB_MUTATION_API_OK_RESPONSE)
  createDelete(@Body() body: CreateOverviewHistoryJobDto, @Req() request: Request) {
    return this.overviewService.enqueueManualDelete(body, request);
  }

  @Post("coverage/renew")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(OVERVIEW_COVERAGE_RENEW_API_OK_RESPONSE)
  renewCoverage(@Body() body: RenewOverviewCoverageDto, @Req() request: Request) {
    return this.overviewService.renewCoverage(body.coverageWindowId, request);
  }

  @Post("jobs/:id/retry")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(OVERVIEW_JOB_MUTATION_API_OK_RESPONSE)
  retryJob(@Param() params: OverviewJobIdParamsDto, @Req() request: Request) {
    return this.overviewService.retryJob(params.id, request);
  }

  @Delete("jobs/:id")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(OVERVIEW_JOB_MUTATION_API_OK_RESPONSE)
  deleteJob(@Param() params: OverviewJobIdParamsDto) {
    return this.overviewService.deleteJob(params.id);
  }
}
