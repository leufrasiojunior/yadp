import {
  BadRequestException,
  Inject,
  Injectable,
  PreconditionFailedException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { AuditService } from "../audit/audit.service";
import { fromDbLoginMode } from "../common/auth/login-mode";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { DEFAULT_API_TIME_ZONE, normalizeApiTimeZone } from "../common/i18n/time-zone";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { isPrismaMissingModelTable } from "../common/prisma/prisma-errors";
import { AppEnvService } from "../config/app-env";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import { PiholeWorkCoordinatorService } from "../pihole/pihole-work-coordinator.service";
import type { LoginDto } from "./dto/login.dto";
import type { UpdateSessionPreferencesDto } from "./dto/update-session-preferences.dto";
import type { SessionCookiePayload } from "./session.types";

@Injectable()
export class SessionService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(AppEnvService) private readonly env: AppEnvService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PiholeWorkCoordinatorService) private readonly coordinator: PiholeWorkCoordinatorService,
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
    const ipAddress = getRequestIp(request);

    if (loginMode === "yapd-password") {
      if (!appConfig?.passwordHash) {
        throw new PreconditionFailedException(translateApi(locale, "session.localLoginUnavailable"));
      }

      if (!this.crypto.verifyPassword(dto.password, appConfig.passwordHash)) {
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

      const instanceSessions = await this.instanceSessions.bootstrapAllSessions(locale);
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
          failedInstanceCount: instanceSessions.failedInstances.length,
        } satisfies Prisma.InputJsonObject,
      });

      return this.buildSessionResponse(
        {
          id: baseline.id,
          name: baseline.name,
          baseUrl: baseline.baseUrl,
        },
        payload,
        instanceSessions,
        this.resolveAppTimeZone(appConfig),
      );
    }

    const connection = {
      baseUrl: baseline.baseUrl,
      allowSelfSigned: baseline.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: baseline.certificateTrust?.certificatePem ?? null,
      locale,
    };

    try {
      const { authenticated, seeded } = await this.coordinator.runForInstance(
        baseline.id,
        connection,
        "session.login",
        async () => {
          const session = await this.pihole.authenticate(connection, dto.password, dto.totp);
          const persisted = await this.instanceSessions.seedSessionFromLogin(
            baseline.id,
            locale,
            {
              sid: session.sid,
              csrf: session.csrf,
            },
            "HUMAN_MASTER",
          );

          return {
            authenticated: session,
            seeded: persisted,
          };
        },
      );
      const instanceSessions = await this.instanceSessions.bootstrapAllSessions(locale, {
        seededSessions: {
          [baseline.id]: {
            session: {
              sid: authenticated.sid,
              csrf: authenticated.csrf,
            },
            authSource: "HUMAN_MASTER",
          },
        },
      });
      const payload: SessionCookiePayload = {
        authMethod: loginMode,
        baselineInstanceId: baseline.id,
        expiresAt: seeded.summary.validUntil ?? new Date(Date.now() + authenticated.validity * 1000).toISOString(),
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
          validitySeconds: authenticated.validity,
          usedTotp: Boolean(dto.totp),
          failedInstanceCount: instanceSessions.failedInstances.length,
        } satisfies Prisma.InputJsonObject,
      });

      return this.buildSessionResponse(
        {
          id: baseline.id,
          name: baseline.name,
          baseUrl: baseline.baseUrl,
        },
        payload,
        instanceSessions,
        this.resolveAppTimeZone(appConfig),
      );
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

  async getCurrentSession(request: Request, response: Response) {
    const locale = getRequestLocale(request);
    const payload = this.requireSession(request);
    const [baseline, appConfig] = await Promise.all([
      this.prisma.instance.findUnique({
        where: { id: payload.baselineInstanceId },
      }),
      this.readAppConfigOrNull(),
    ]);

    if (!baseline) {
      this.clearSessionCookie(response);
      throw new UnauthorizedException(translateApi(locale, "session.baselineMissing"));
    }

    let nextPayload = payload;

    if (payload.authMethod === "pihole-master") {
      try {
        const active = await this.instanceSessions.ensureActiveSession(baseline.id, locale);

        if (active.summary.validUntil) {
          nextPayload = {
            ...payload,
            expiresAt: active.summary.validUntil,
          };
          this.writeSessionCookie(response, nextPayload);
        }
      } catch (error) {
        this.clearSessionCookie(response);
        throw new UnauthorizedException(
          error instanceof Error ? error.message : translateApi(locale, "session.expired"),
        );
      }
    }

    return this.buildSessionResponse(
      {
        id: baseline.id,
        name: baseline.name,
        baseUrl: baseline.baseUrl,
      },
      nextPayload,
      null,
      this.resolveAppTimeZone(appConfig),
    );
  }

  async updatePreferences(dto: UpdateSessionPreferencesDto, request: Request) {
    const locale = getRequestLocale(request);
    const session = this.requireSession(request);
    const baseline = await this.prisma.instance.findUnique({
      where: { id: session.baselineInstanceId },
    });
    const timeZone = normalizeApiTimeZone(dto.timeZone, "");

    if (timeZone.length === 0) {
      throw new BadRequestException(translateApi(locale, "session.invalidTimeZone"));
    }

    await this.prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: {
        timeZone,
      },
      create: {
        id: "singleton",
        timeZone,
      },
    });

    await this.audit.record({
      action: "session.preferences.update",
      actorType: session.authMethod === "yapd-password" ? "yapd_operator" : "pihole_operator",
      actorLabel: baseline?.name ?? null,
      ipAddress: getRequestIp(request),
      targetType: "app_config",
      targetId: "singleton",
      result: "SUCCESS",
      details: {
        timeZone,
      } satisfies Prisma.InputJsonObject,
    });

    return {
      timeZone,
    };
  }

  async logout(request: Request, response: Response) {
    const payload = this.readSession(request);
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    if (payload) {
      const baseline = await this.prisma.instance.findUnique({
        where: { id: payload.baselineInstanceId },
      });

      if (baseline) {
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
      } else {
        this.clearSessionCookie(response);
        throw new UnauthorizedException(translateApi(locale, "session.baselineMissing"));
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
      secure: this.env.values.COOKIE_SECURE,
      path: "/",
    });
  }

  private buildSessionResponse(
    baseline: {
      id: string;
      name: string;
      baseUrl: string;
    },
    payload: SessionCookiePayload,
    instanceSessions: Awaited<ReturnType<PiholeInstanceSessionService["bootstrapAllSessions"]>> | null,
    timeZone: string,
  ) {
    return {
      authenticated: true as const,
      authMethod: payload.authMethod,
      baseline,
      expiresAt: payload.expiresAt,
      timeZone,
      csrfToken: payload.antiCsrfToken,
      instanceSessions: instanceSessions ?? {
        successfulInstances: [],
        failedInstances: [],
      },
    };
  }

  private writeSessionCookie(response: Response, payload: SessionCookiePayload) {
    response.cookie(this.env.values.SESSION_COOKIE_NAME, this.crypto.encryptSession(payload), {
      httpOnly: true,
      secure: this.env.values.COOKIE_SECURE,
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

  private resolveAppTimeZone(appConfig: { timeZone?: string | null } | null) {
    return normalizeApiTimeZone(appConfig?.timeZone, DEFAULT_API_TIME_ZONE);
  }
}
