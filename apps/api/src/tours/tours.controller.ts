import { Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { ProductTourKeyParamsDto } from "./dto/product-tour-key-params.dto";
import { PRODUCT_TOUR_STATUS_API_OK_RESPONSE } from "./tours.responses";
import { ToursService } from "./tours.service";

@ApiTags("tours")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("tours")
export class ToursController {
  constructor(@Inject(ToursService) private readonly toursService: ToursService) {}

  @Get(":tourKey")
  @ApiOkResponse(PRODUCT_TOUR_STATUS_API_OK_RESPONSE)
  getStatus(@Param() params: ProductTourKeyParamsDto, @Req() request: Request) {
    return this.toursService.getStatus(params.tourKey, request);
  }

  @Post(":tourKey/complete")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(PRODUCT_TOUR_STATUS_API_OK_RESPONSE)
  complete(
    @Param() params: ProductTourKeyParamsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.toursService.complete(params.tourKey, request, response);
  }
}
