import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import type { CreateBaselineDto } from "./dto/create-baseline.dto";
import { SetupService } from "./setup.service";

@ApiTags("setup")
@Controller("setup")
export class SetupController {
  constructor(@Inject(SetupService) private readonly setupService: SetupService) {}

  @Get("status")
  @ApiOkResponse()
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post("baseline")
  @ApiCreatedResponse()
  createBaseline(@Body() body: CreateBaselineDto, @Req() request: Request) {
    return this.setupService.createBaseline(body, request);
  }
}
