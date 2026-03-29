import { Inject, Injectable, PreconditionFailedException, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";

import { AuditService } from "../audit/audit.service";
import { fromDbLoginMode } from "../common/auth/login-mode";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { isPrismaMissingModelTable } from "../common/prisma/prisma-errors";
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
    const locale = getRequestLocale(request);
    const [baseline, appConfig] = await Promise.all([
      this.prisma.instance.findFirst({
        where: { isBaseline: true },
        include: {
          certificateTrust: true,
        },
      }),
      this.readAppConfigOrNull(),
    ]);

    if (!baseline) {
      throw new PreconditionFailedException(translateApi(locale, "session.baselineRequired"));
    }

    const loginMode = fromDbLoginMode(appConfig?.loginMode);
    const connection = {
      baseUrl: baseline.baseUrl,
      allowSelfSigned: baseline.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: baseline.certificateTrust?.certificatePem ?? null,
      locale,
    };
    const ipAddress = getRequestIp(request);

    if (loginMode === "yapd-password") {
      if (!appConfig?.passwordHash) {
        throw new PreconditionFailedException(translateApi(locale, "session.localLoginUnavailable"));
      }

      const isValidPassword = this.crypto.verifyPassword(dto.password, appConfig.passwordHash);

      if (!isValidPassword) {
        await this.audit.record({
          action: "session.login",
          actorType: "yapd_operator",
          actorLabel: baseline.name,
          ipAddress,
          targetType: "instance",
          targetId: baseline.id,
          result: "FAILURE",
          details: {
            authMethod: loginMode,
            error: "Invalid YAPD password",
          } satisfies Prisma.InputJsonObject,
        });

        throw new UnauthorizedException(translateApi(locale, "session.localLoginFailed"));
      }

      const payload: SessionCookiePayload = {
        authMethod: loginMode,
        baselineInstanceId: baseline.id,
        expiresAt: new Date(Date.now() + this.env.values.YAPD_SESSION_TTL_SECONDS * 1000).toISOString(),
        antiCsrfToken: this.crypto.createToken(),
      };

      this.writeSessionCookie(response, payload);

      await this.audit.record({
        action: "session.login",
        actorType: "yapd_operator",
        actorLabel: baseline.name,
        ipAddress,
        targetType: "instance",
        targetId: baseline.id,
        result: "SUCCESS",
        details: {
          authMethod: loginMode,
          validitySeconds: this.env.values.YAPD_SESSION_TTL_SECONDS,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        authenticated: true as const,
        authMethod: loginMode,
        baseline: {
          id: baseline.id,
          name: baseline.name,
          baseUrl: baseline.baseUrl,
        },
        expiresAt: payload.expiresAt,
        csrfToken: payload.antiCsrfToken,
      };
    }

    try {
      const session = await this.pihole.authenticate(connection, dto.password, dto.totp);
      const payload: SessionCookiePayload = {
        authMethod: loginMode,
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
          authMethod: loginMode,
          validitySeconds: session.validity,
          usedTotp: Boolean(dto.totp),
        } satisfies Prisma.InputJsonObject,
      });

      return {
        authenticated: true as const,
        authMethod: loginMode,
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
          authMethod: loginMode,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      if (error instanceof PiholeRequestError && error.statusCode === 401) {
        throw new UnauthorizedException(translateApi(locale, "session.loginFailed"));
      }

      throw error;
    }
  }

  async getCurrentSession(request: Request) {
    const locale = getRequestLocale(request);
    const payload = this.requireSession(request);
    const baseline = await this.prisma.instance.findUnique({
      where: { id: payload.baselineInstanceId },
    });

    if (!baseline) {
      throw new UnauthorizedException(translateApi(locale, "session.baselineMissing"));
    }

    return {
      authenticated: true,
      authMethod: payload.authMethod,
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
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    if (payload) {
      const baseline = await this.prisma.instance.findUnique({
        where: { id: payload.baselineInstanceId },
        include: { certificateTrust: true },
      });

      if (baseline) {
        if (payload.authMethod === "pihole-master" && payload.sid) {
          try {
            await this.pihole.logout(
              {
                baseUrl: baseline.baseUrl,
                allowSelfSigned: baseline.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
                certificatePem: baseline.certificateTrust?.certificatePem ?? null,
                locale,
              },
              payload.sid,
            );
          } catch {
            // Logging out of Pi-hole is best-effort. We still clear the local session.
          }
        }

        await this.audit.record({
          action: "session.logout",
          actorType: payload.authMethod === "yapd-password" ? "yapd_operator" : "pihole_operator",
          actorLabel: baseline.name,
          ipAddress,
          targetType: "instance",
          targetId: baseline.id,
          result: "SUCCESS",
          details: {
            authMethod: payload.authMethod,
          } satisfies Prisma.InputJsonObject,
        });
      }
    }

    this.clearSessionCookie(response);
  }

  requireSession(request: Request) {
    const locale = getRequestLocale(request);
    const payload = this.readSession(request);

    if (!payload) {
      throw new UnauthorizedException(translateApi(locale, "session.noActiveSession"));
    }

    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException(translateApi(locale, "session.expired"));
    }

    return payload;
  }

  readSession(request: Request) {
    const rawCookie = request.cookies?.[this.env.values.SESSION_COOKIE_NAME];

    if (!rawCookie) {
      return null;
    }

    try {
      const payload = this.crypto.decryptSession<
        SessionCookiePayload & { authMethod?: SessionCookiePayload["authMethod"] }
      >(rawCookie);

      return {
        ...payload,
        authMethod: payload.authMethod ?? "pihole-master",
      };
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

  private async readAppConfigOrNull() {
    try {
      return await this.prisma.appConfig.findUnique({
        where: { id: "singleton" },
      });
    } catch (error) {
      if (isPrismaMissingModelTable(error, "AppConfig")) {
        return null;
      }

      throw error;
    }
  }
}
