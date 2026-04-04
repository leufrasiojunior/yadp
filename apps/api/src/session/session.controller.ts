import { Body, Controller, Delete, Get, Inject, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { CsrfGuard } from "./csrf.guard";
// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { LoginDto } from "./dto/login.dto";
import type { UpdateSessionPreferencesDto } from "./dto/update-session-preferences.dto";
import { SessionGuard } from "./session.guard";
import { SessionService } from "./session.service";

@ApiTags("session")
@Controller("session")
export class SessionController {
  private readonly sessionService: SessionService;

  constructor(@Inject(SessionService) sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  @Post("login")
  @ApiOkResponse()
  login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.sessionService.login(body, request, response);
  }

  @Get()
  @ApiCookieAuth()
  @ApiOkResponse()
  getCurrentSession(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.sessionService.getCurrentSession(request, response);
  }

  @Delete()
  @ApiCookieAuth()
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessionService.logout(request, response);
    return { ok: true };
  }

  @Patch("preferences")
  @ApiCookieAuth()
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse()
  updatePreferences(@Body() body: UpdateSessionPreferencesDto, @Req() request: Request) {
    return this.sessionService.updatePreferences(body, request);
  }
}
