import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { CreateBaselineDto } from "./dto/create-baseline.dto";
import { SetupService } from "./setup.service";

@ApiTags("setup")
@Controller("setup")
export class SetupController {
  private readonly setupService: SetupService;

  constructor(@Inject(SetupService) setupService: SetupService) {
    this.setupService = setupService;
  }

  @Get("status")
  @ApiOkResponse()
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post("baseline")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiCreatedResponse()
  createBaseline(@Body() body: CreateBaselineDto, @Req() request: Request) {
    return this.setupService.createBaseline(body, request);
  }
}
