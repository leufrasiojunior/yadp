import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { CertificateTrustMode, Prisma } from "../common/prisma/prisma-client";
import {
  InvalidManagedInstanceBaseUrlError,
  normalizeManagedInstanceBaseUrl,
} from "../common/url/managed-instance-base-url";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { PiholeConnection } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import { PiholeWorkCoordinatorService } from "../pihole/pihole-work-coordinator.service";
import type { CreateInstanceDto } from "./dto/create-instance.dto";
import type { DiscoverInstancesDto } from "./dto/discover-instances.dto";
import type { UpdateInstanceDto } from "./dto/update-instance.dto";
import type { UpdateInstanceSyncDto } from "./dto/update-instance-sync.dto";

const DEFAULT_DISCOVERY_CANDIDATES = ["https://pi.hole", "http://pi.hole"];

@Injectable()
export class InstancesService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PiholeWorkCoordinatorService) private readonly coordinator: PiholeWorkCoordinatorService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listInstances() {
    const [instances, states] = await Promise.all([
      this.prisma.instance.findMany({
        orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
        include: {
          certificateTrust: true,
        },
      }),
      this.instanceSessions.listInstanceStates(),
    ]);
    const stateMap = new Map(states.map((item) => [item.instanceId, item.summary]));

    return {
      items: instances.map((instance) => {
        const session = stateMap.get(instance.id);

        return {
          id: instance.id,
          name: instance.name,
          baseUrl: instance.baseUrl,
          isBaseline: instance.isBaseline,
          syncEnabled: instance.syncEnabled,
          lastKnownVersion: instance.lastKnownVersion,
          lastValidatedAt: instance.lastValidatedAt,
          trustMode: instance.certificateTrust?.mode ?? "STRICT",
          hasCustomCertificate: Boolean(instance.certificateTrust?.certificatePem),
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
          sessionStatus: session?.status ?? "missing",
          sessionManagedBy: session?.managedBy ?? null,
          sessionLoginAt: session?.loginAt ?? null,
          sessionLastActiveAt: session?.lastActiveAt ?? null,
          sessionValidUntil: session?.validUntil ?? null,
          sessionLastErrorKind: session?.lastErrorKind ?? null,
          sessionLastErrorMessage: session?.lastErrorMessage ?? null,
        };
      }),
    };
  }

  async getInstance(instanceId: string, request: Request) {
    const locale = getRequestLocale(request);
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        certificateTrust: true,
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    return {
      instance: {
        id: instance.id,
        name: instance.name,
        baseUrl: instance.baseUrl,
        isBaseline: instance.isBaseline,
        syncEnabled: instance.syncEnabled,
        trustMode: instance.certificateTrust?.mode ?? "STRICT",
        hasCustomCertificate: Boolean(instance.certificateTrust?.certificatePem),
        allowSelfSigned: instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
        certificatePem: instance.certificateTrust?.certificatePem ?? null,
      },
    };
  }

  async getInstanceInfo(instanceId: string, request: Request) {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    try {
      const info = await this.instanceSessions.withActiveSession(
        instanceId,
        locale,
        async ({ connection, session }) => {
          const [version, host, system] = await Promise.all([
            this.pihole.readVersionDetails(connection, session),
            this.pihole.readHostInfo(connection, session),
            this.pihole.readSystemInfo(connection, session),
          ]);

          return {
            instanceId,
            fetchedAt: new Date().toISOString(),
            version: {
              summary: version.summary,
              core: version.core,
              web: version.web,
              ftl: version.ftl,
              docker: version.docker,
            },
            host,
            system,
          };
        },
        { allowDisabled: true },
      );

      await this.audit.record({
        action: "instances.info",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "SUCCESS",
        details: {
          fetchedAt: info.fetchedAt,
          versionSummary: info.version.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return info;
    } catch (error) {
      await this.audit.record({
        action: "instances.info",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error, locale);
    }
  }

  async discoverInstances(dto: DiscoverInstancesDto, request: Request) {
    const locale = getRequestLocale(request);
    const candidates = Array.from(new Set(dto.candidates?.length ? dto.candidates : DEFAULT_DISCOVERY_CANDIDATES));
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const discovery = await this.coordinator.runForConnection(
            {
              baseUrl: candidate,
              locale,
            },
            "instances.discover",
            () =>
              this.pihole.checkAuthenticationRequired({
                baseUrl: candidate,
                locale,
              }),
          );

          return {
            baseUrl: candidate,
            reachable: true,
            authRequired: discovery.authRequired,
          };
        } catch (error) {
          return {
            baseUrl: candidate,
            reachable: false,
            authRequired: true,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    await this.audit.record({
      action: "instances.discover",
      actorType: "session",
      ipAddress: getRequestIp(request),
      result: "SUCCESS",
      details: {
        candidates,
        reachable: results.filter((item) => item.reachable).length,
      } satisfies Prisma.InputJsonObject,
    });

    return {
      items: results,
    };
  }

  async createInstance(dto: CreateInstanceDto, request: Request) {
    const locale = getRequestLocale(request);
    const normalizedBaseUrl = this.normalizeConfiguredBaseUrl(dto.baseUrl, locale);
    const connection = {
      baseUrl: normalizedBaseUrl,
      allowSelfSigned: dto.allowSelfSigned ?? false,
      certificatePem: dto.certificatePem ?? null,
      locale,
    };
    const ipAddress = getRequestIp(request);

    this.assertTrustConfiguration(locale, connection.allowSelfSigned ?? false, connection.certificatePem);

    try {
      const { session, version } = await this.coordinator.runForConnection(connection, "instances.create", async () => {
        const authenticated = await this.pihole.authenticate(connection, dto.servicePassword);
        const capabilities = await this.pihole.readCapabilities(connection, authenticated);

        return {
          session: authenticated,
          version: capabilities,
        };
      });

      const instance = await this.prisma.$transaction(async (tx) => {
        const createdInstance = await tx.instance.create({
          data: {
            name: dto.name,
            baseUrl: normalizedBaseUrl,
            isBaseline: false,
            lastKnownVersion: version.summary,
            lastValidatedAt: new Date(),
          },
        });

        await tx.instanceSecret.create({
          data: {
            instanceId: createdInstance.id,
            encryptedPassword: this.crypto.encryptSecret(dto.servicePassword),
          },
        });

        await tx.instanceCertificateTrust.create({
          data: {
            instanceId: createdInstance.id,
            mode: this.resolveTrustMode(dto.allowSelfSigned ?? false, dto.certificatePem),
            certificatePem: dto.certificatePem ?? null,
          },
        });

        return createdInstance;
      });

      await this.instanceSessions.seedSessionFromLogin(
        instance.id,
        locale,
        {
          sid: session.sid,
          csrf: session.csrf,
        },
        "STORED_SECRET",
      );
      await this.audit.record({
        action: "instances.create",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instance.id,
        result: "SUCCESS",
        details: {
          baseUrl: normalizedBaseUrl,
          name: dto.name,
          version: version.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        instance: {
          id: instance.id,
          name: instance.name,
          baseUrl: instance.baseUrl,
          version: version.summary,
        },
      };
    } catch (error) {
      await this.audit.record({
        action: "instances.create",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        result: "FAILURE",
        details: {
          baseUrl: normalizedBaseUrl,
          name: dto.name,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error, locale);
    }
  }

  async updateInstance(instanceId: string, dto: UpdateInstanceDto, request: Request) {
    const locale = getRequestLocale(request);
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        secret: true,
        certificateTrust: true,
      },
    });

    if (!instance || !instance.secret) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    const normalizedBaseUrl = this.normalizeConfiguredBaseUrl(dto.baseUrl ?? instance.baseUrl, locale);
    const connection = {
      baseUrl: normalizedBaseUrl,
      allowSelfSigned: dto.allowSelfSigned ?? instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: dto.certificatePem ?? instance.certificateTrust?.certificatePem ?? null,
      locale,
    };
    const ipAddress = getRequestIp(request);

    this.assertTrustConfiguration(locale, connection.allowSelfSigned ?? false, connection.certificatePem);

    try {
      const updated = await this.coordinator.runForInstance(instanceId, connection, "instances.update", async () => {
        const currentInstance = await this.prisma.instance.findUnique({
          where: { id: instanceId },
          include: {
            secret: true,
            certificateTrust: true,
          },
        });

        if (!currentInstance || !currentInstance.secret) {
          throw new NotFoundException(translateApi(locale, "instances.notFound"));
        }

        const effectiveConnection = {
          baseUrl: this.normalizeConfiguredBaseUrl(dto.baseUrl ?? currentInstance.baseUrl, locale),
          allowSelfSigned: dto.allowSelfSigned ?? currentInstance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
          certificatePem: dto.certificatePem ?? currentInstance.certificateTrust?.certificatePem ?? null,
          locale,
        } satisfies PiholeConnection;

        this.assertTrustConfiguration(
          locale,
          effectiveConnection.allowSelfSigned ?? false,
          effectiveConnection.certificatePem,
        );

        const existingEncryptedPassword = currentInstance.secret.encryptedPassword;
        const servicePassword = dto.servicePassword ?? this.crypto.decryptSecret(existingEncryptedPassword);
        const session = await this.pihole.authenticate(effectiveConnection, servicePassword);
        const version = await this.pihole.readCapabilities(effectiveConnection, session);

        const updatedInstance = await this.prisma.$transaction(async (tx) => {
          const persistedInstance = await tx.instance.update({
            where: { id: instanceId },
            data: {
              name: dto.name ?? currentInstance.name,
              baseUrl: effectiveConnection.baseUrl,
              lastKnownVersion: version.summary,
              lastValidatedAt: new Date(),
            },
          });

          await tx.instanceSecret.update({
            where: { instanceId },
            data: {
              encryptedPassword: dto.servicePassword
                ? this.crypto.encryptSecret(dto.servicePassword)
                : existingEncryptedPassword,
            },
          });

          await tx.instanceCertificateTrust.upsert({
            where: { instanceId },
            update: {
              mode: this.resolveTrustMode(
                effectiveConnection.allowSelfSigned ?? false,
                effectiveConnection.certificatePem,
              ),
              certificatePem: effectiveConnection.certificatePem,
            },
            create: {
              instanceId,
              mode: this.resolveTrustMode(
                effectiveConnection.allowSelfSigned ?? false,
                effectiveConnection.certificatePem,
              ),
              certificatePem: effectiveConnection.certificatePem,
            },
          });

          return persistedInstance;
        });

        await this.instanceSessions.seedSessionFromLogin(
          updatedInstance.id,
          locale,
          {
            sid: session.sid,
            csrf: session.csrf,
          },
          "STORED_SECRET",
          { allowDisabled: true },
        );

        return {
          instance: updatedInstance,
          version,
        };
      });
      await this.audit.record({
        action: "instances.update",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: updated.instance.id,
        result: "SUCCESS",
        details: {
          baseUrl: updated.instance.baseUrl,
          name: updated.instance.name,
          version: updated.version.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        instance: {
          id: updated.instance.id,
          name: updated.instance.name,
          baseUrl: updated.instance.baseUrl,
          version: updated.version.summary,
        },
      };
    } catch (error) {
      await this.audit.record({
        action: "instances.update",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error, locale);
    }
  }

  async testInstance(instanceId: string, request: Request) {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    try {
      const health = await this.instanceSessions.withActiveSession(
        instanceId,
        locale,
        async ({ connection, session }) => this.pihole.healthCheck(connection, session),
        { allowDisabled: true },
      );

      await this.prisma.instance.update({
        where: { id: instanceId },
        data: {
          lastKnownVersion: health.version,
          lastValidatedAt: new Date(),
        },
      });

      await this.audit.record({
        action: "instances.test",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "SUCCESS",
        details: {
          version: health.version,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        ok: true,
        version: health.version,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.audit.record({
        action: "instances.test",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error, locale);
    }
  }

  async reauthenticateInstance(instanceId: string, request: Request) {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    try {
      const connection = await this.loadInstanceConnection(instanceId, locale);
      const { active, health } = await this.coordinator.runForInstance(
        instanceId,
        connection,
        "instances.reauthenticate",
        async () => {
          const refreshedSession = await this.instanceSessions.forceReauthenticate(instanceId, locale, {
            allowDisabled: true,
          });
          const sessionHealth = await this.pihole.healthCheck(refreshedSession.connection, refreshedSession.session);

          return {
            active: refreshedSession,
            health: sessionHealth,
          };
        },
      );

      await this.prisma.instance.update({
        where: { id: instanceId },
        data: {
          lastKnownVersion: health.version,
          lastValidatedAt: new Date(),
        },
      });

      await this.audit.record({
        action: "instances.reauthenticate",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "SUCCESS",
        details: {
          version: health.version,
          validUntil: active.summary.validUntil,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        ok: true,
        version: health.version,
        checkedAt: new Date().toISOString(),
        sessionStatus: active.summary.status,
        sessionLoginAt: active.summary.loginAt,
        sessionLastActiveAt: active.summary.lastActiveAt,
        sessionValidUntil: active.summary.validUntil,
      };
    } catch (error) {
      await this.audit.record({
        action: "instances.reauthenticate",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instanceId,
        result: "FAILURE",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error, locale);
    }
  }

  async updateInstanceSync(instanceId: string, dto: UpdateInstanceSyncDto, request: Request) {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        name: true,
        isBaseline: true,
        syncEnabled: true,
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    if (instance.isBaseline && !dto.enabled) {
      throw new ConflictException(translateApi(locale, "instances.syncBaselineRequired"));
    }

    const updated = await this.prisma.instance.update({
      where: { id: instanceId },
      data: {
        syncEnabled: dto.enabled,
      },
      select: {
        id: true,
        name: true,
        syncEnabled: true,
      },
    });

    await this.audit.record({
      action: "instances.sync.toggle",
      actorType: "session",
      ipAddress,
      targetType: "instance",
      targetId: updated.id,
      result: "SUCCESS",
      details: {
        previousValue: instance.syncEnabled,
        nextValue: updated.syncEnabled,
      } satisfies Prisma.InputJsonObject,
    });

    return {
      instance: updated,
    };
  }

  private mapPiholeError(error: unknown, locale: ReturnType<typeof getRequestLocale>): never {
    if (error instanceof PiholeRequestError && error.statusCode === 401) {
      throw new UnauthorizedException(translateApi(locale, "instances.invalidCredentials"));
    }

    if (error instanceof PiholeRequestError) {
      throw new BadGatewayException(error.message);
    }

    throw error;
  }

  private resolveTrustMode(allowSelfSigned: boolean, certificatePem?: string | null): CertificateTrustMode {
    if (certificatePem) {
      return "CUSTOM_CA";
    }

    return allowSelfSigned ? "ALLOW_SELF_SIGNED" : "STRICT";
  }

  private assertTrustConfiguration(
    locale: ReturnType<typeof getRequestLocale>,
    allowSelfSigned: boolean,
    certificatePem?: string | null,
  ) {
    if (allowSelfSigned && certificatePem) {
      throw new BadRequestException(translateApi(locale, "instances.invalidTrustConfiguration"));
    }
  }

  private async loadInstanceConnection(instanceId: string, locale: ReturnType<typeof getRequestLocale>) {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        certificateTrust: {
          select: {
            mode: true,
            certificatePem: true,
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    return {
      baseUrl: this.normalizeConfiguredBaseUrl(instance.baseUrl, locale),
      allowSelfSigned: instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: instance.certificateTrust?.certificatePem ?? null,
      locale,
    } satisfies PiholeConnection;
  }

  private normalizeConfiguredBaseUrl(baseUrl: string, locale: ReturnType<typeof getRequestLocale>) {
    try {
      return normalizeManagedInstanceBaseUrl(baseUrl);
    } catch (error) {
      if (error instanceof InvalidManagedInstanceBaseUrlError) {
        throw new BadRequestException(translateApi(locale, "instances.invalidBaseUrl"));
      }

      throw error;
    }
  }
}
