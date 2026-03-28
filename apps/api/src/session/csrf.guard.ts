import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthenticatedRequest } from "./session.guard";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers["x-yapd-csrf"];

    if (typeof token !== "string" || token !== request.yapdSession?.antiCsrfToken) {
      throw new ForbiddenException("Missing or invalid CSRF token.");
    }

    return true;
  }
}
