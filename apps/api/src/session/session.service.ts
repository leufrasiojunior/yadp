import { Inject, Injectable, PreconditionFailedException, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";

import { AuditService } from "../audit/audit.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { AppEnvService } from "../config/app-env";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { LoginDto } from "./dto/login.dto";
import type { SessionCookiePayload } from "./session.types";

@Injectable()
export class SessionService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(AppEnvService) private readonly env: AppEnvService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, request: Request, response: Response) {
    const baseline = await this.prisma.instance.findFirst({
      where: { isBaseline: true },
      include: {
        certificateTrust: true,
      },
    });

    if (!baseline) {
      throw new PreconditionFailedException("You must configure the baseline before logging in.");
    }

    const connection = {
      baseUrl: baseline.baseUrl,
      allowSelfSigned: baseline.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: baseline.certificateTrust?.certificatePem ?? null,
    };
    const ipAddress = getRequestIp(request);

    try {
      const session = await this.pihole.authenticate(connection, dto.password, dto.totp);
      const payload: SessionCookiePayload = {
        baselineInstanceId: baseline.id,
        sid: session.sid,
        csrf: session.csrf,
        expiresAt: new Date(Date.now() + session.validity * 1000).toISOString(),
        antiCsrfToken: this.crypto.createToken(),
      };

      this.writeSessionCookie(response, payload);

      await this.audit.record({
        action: "session.login",
        actorType: "pihole_operator",
        actorLabel: baseline.name,
        ipAddress,
        targetType: "instance",
        targetId: baseline.id,
        result: "SUCCESS",
        details: {
          validitySeconds: session.validity,
          usedTotp: Boolean(dto.totp),
        } satisfies Prisma.InputJsonObject,
      });

      return {
        baseline: {
          id: baseline.id,
          name: baseline.name,
          baseUrl: baseline.baseUrl,
        },
        expiresAt: payload.expiresAt,
        csrfToken: payload.antiCsrfToken,
      };
    } catch (error) {
      await this.audit.record({
        action: "session.login",
        actorType: "pihole_operator",
        actorLabel: baseline.name,
        ipAddress,
        targetType: "instance",
        targetId: baseline.id,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      if (error instanceof PiholeRequestError && error.statusCode === 401) {
        throw new UnauthorizedException("The Pi-hole login failed.");
      }

      throw error;
    }
  }

  async getCurrentSession(request: Request) {
    const payload = this.requireSession(request);
    const baseline = await this.prisma.instance.findUnique({
      where: { id: payload.baselineInstanceId },
    });

    if (!baseline) {
      throw new UnauthorizedException("The baseline instance is no longer available.");
    }

    return {
      authenticated: true,
      baseline: {
        id: baseline.id,
        name: baseline.name,
        baseUrl: baseline.baseUrl,
      },
      expiresAt: payload.expiresAt,
      csrfToken: payload.antiCsrfToken,
    };
  }

  async logout(request: Request, response: Response) {
    const payload = this.readSession(request);
    const ipAddress = getRequestIp(request);

    if (payload) {
      const baseline = await this.prisma.instance.findUnique({
        where: { id: payload.baselineInstanceId },
        include: { certificateTrust: true },
      });

      if (baseline) {
        try {
          await this.pihole.logout(
            {
              baseUrl: baseline.baseUrl,
              allowSelfSigned: baseline.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
              certificatePem: baseline.certificateTrust?.certificatePem ?? null,
            },
            payload.sid,
          );
        } catch {
          // Logging out of Pi-hole is best-effort. We still clear the local session.
        }

        await this.audit.record({
          action: "session.logout",
          actorType: "pihole_operator",
          actorLabel: baseline.name,
          ipAddress,
          targetType: "instance",
          targetId: baseline.id,
          result: "SUCCESS",
        });
      }
    }

    this.clearSessionCookie(response);
  }

  requireSession(request: Request) {
    const payload = this.readSession(request);

    if (!payload) {
      throw new UnauthorizedException("No active YAPD session was found.");
    }

    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException("The session has expired.");
    }

    return payload;
  }

  readSession(request: Request) {
    const rawCookie = request.cookies?.[this.env.values.SESSION_COOKIE_NAME];

    if (!rawCookie) {
      return null;
    }

    try {
      return this.crypto.decryptSession<SessionCookiePayload>(rawCookie);
    } catch {
      return null;
    }
  }

  clearSessionCookie(response: Response) {
    response.clearCookie(this.env.values.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "strict",
      secure: this.env.values.COOKIE_SECURE || this.env.isProduction,
      path: "/",
    });
  }

  private writeSessionCookie(response: Response, payload: SessionCookiePayload) {
    response.cookie(this.env.values.SESSION_COOKIE_NAME, this.crypto.encryptSession(payload), {
      httpOnly: true,
      secure: this.env.values.COOKIE_SECURE || this.env.isProduction,
      sameSite: "strict",
      expires: new Date(payload.expiresAt),
      path: "/",
    });
  }
}
