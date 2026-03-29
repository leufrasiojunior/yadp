import { Body, Controller, Delete, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

// biome-ignore lint/style/useImportType: Nest validation metadata needs the DTO class at runtime.
import { LoginDto } from "./dto/login.dto";
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
  getCurrentSession(@Req() request: Request) {
    return this.sessionService.getCurrentSession(request);
  }

  @Delete()
  @ApiCookieAuth()
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessionService.logout(request, response);
    return { ok: true };
  }
}
