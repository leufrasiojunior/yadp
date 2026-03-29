import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { SessionService } from "./session.service";
import type { SessionCookiePayload } from "./session.types";

export type AuthenticatedRequest = Request & {
  yapdSession?: SessionCookiePayload;
};

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly sessionService: SessionService;

  constructor(@Inject(SessionService) sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.yapdSession = this.sessionService.requireSession(request);

    return true;
  }
}
