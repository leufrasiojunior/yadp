import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { SessionService } from "./session.service";
import type { SessionCookiePayload } from "./session.types";

export type AuthenticatedRequest = Request & {
  yapdSession?: SessionCookiePayload;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessionService: SessionService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.yapdSession = this.sessionService.requireSession(request);

    if (!request.yapdSession) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
