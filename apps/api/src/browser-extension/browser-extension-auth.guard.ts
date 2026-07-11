import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { PrismaService } from "../common/prisma/prisma.service";
import { type BrowserExtensionAuthContext, sha256Hex, timingSafeEqualString } from "./browser-extension.types";

export type BrowserExtensionAuthenticatedRequest = Request & {
  browserExtension?: BrowserExtensionAuthContext;
};

@Injectable()
export class BrowserExtensionAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<BrowserExtensionAuthenticatedRequest>();
    const header = request.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing browser extension token.");
    }

    const tokenHash = sha256Hex(token);
    const device = await this.prisma.browserExtensionDevice.findUnique({
      where: { tokenHash },
    });

    if (!device || device.revokedAt || !timingSafeEqualString(device.tokenHash, tokenHash)) {
      throw new UnauthorizedException("Invalid browser extension token.");
    }

    await this.prisma.browserExtensionDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    request.browserExtension = {
      id: device.id,
      name: device.name,
      browser: device.browser,
      manifestVersion: device.manifestVersion,
      extensionVersion: device.extensionVersion,
      tokenPrefix: device.tokenPrefix,
    };

    return true;
  }
}
