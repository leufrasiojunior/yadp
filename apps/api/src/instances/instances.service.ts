import { BadGatewayException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { PrismaService } from "../common/prisma/prisma.service";
import type { CertificateTrustMode, Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { CreateInstanceDto } from "./dto/create-instance.dto";
import type { DiscoverInstancesDto } from "./dto/discover-instances.dto";
import type { UpdateInstanceDto } from "./dto/update-instance.dto";

const DEFAULT_DISCOVERY_CANDIDATES = ["https://pi.hole", "http://pi.hole"];

@Injectable()
export class InstancesService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listInstances() {
    const instances = await this.prisma.instance.findMany({
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      include: {
        certificateTrust: true,
      },
    });

    return {
      items: instances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        baseUrl: instance.baseUrl,
        isBaseline: instance.isBaseline,
        lastKnownVersion: instance.lastKnownVersion,
        lastValidatedAt: instance.lastValidatedAt,
        trustMode: instance.certificateTrust?.mode ?? "STRICT",
        hasCustomCertificate: Boolean(instance.certificateTrust?.certificatePem),
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      })),
    };
  }

  async discoverInstances(dto: DiscoverInstancesDto, request: Request) {
    const candidates = Array.from(new Set(dto.candidates?.length ? dto.candidates : DEFAULT_DISCOVERY_CANDIDATES));
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const discovery = await this.pihole.checkAuthenticationRequired({
            baseUrl: candidate,
          });

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
    const connection = {
      baseUrl: dto.baseUrl,
      allowSelfSigned: dto.allowSelfSigned ?? false,
      certificatePem: dto.certificatePem ?? null,
    };
    const ipAddress = getRequestIp(request);

    try {
      const session = await this.pihole.authenticate(connection, dto.servicePassword);
      const version = await this.pihole.readCapabilities(connection, session);

      const instance = await this.prisma.$transaction(async (tx) => {
        const createdInstance = await tx.instance.create({
          data: {
            name: dto.name,
            baseUrl: dto.baseUrl,
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

      await this.safeLogout(connection, session.sid);
      await this.audit.record({
        action: "instances.create",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: instance.id,
        result: "SUCCESS",
        details: {
          baseUrl: dto.baseUrl,
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
          baseUrl: dto.baseUrl,
          name: dto.name,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      this.mapPiholeError(error);
    }
  }

  async updateInstance(instanceId: string, dto: UpdateInstanceDto, request: Request) {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        secret: true,
        certificateTrust: true,
      },
    });

    if (!instance || !instance.secret) {
      throw new NotFoundException("Instance not found.");
    }

    const existingEncryptedPassword = instance.secret.encryptedPassword;
    const servicePassword = dto.servicePassword ?? this.crypto.decryptSecret(existingEncryptedPassword);
    const connection = {
      baseUrl: dto.baseUrl ?? instance.baseUrl,
      allowSelfSigned: dto.allowSelfSigned ?? instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: dto.certificatePem ?? instance.certificateTrust?.certificatePem ?? null,
    };
    const ipAddress = getRequestIp(request);

    try {
      const session = await this.pihole.authenticate(connection, servicePassword);
      const version = await this.pihole.readCapabilities(connection, session);

      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedInstance = await tx.instance.update({
          where: { id: instanceId },
          data: {
            name: dto.name ?? instance.name,
            baseUrl: dto.baseUrl ?? instance.baseUrl,
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
            mode: this.resolveTrustMode(connection.allowSelfSigned ?? false, connection.certificatePem),
            certificatePem: connection.certificatePem,
          },
          create: {
            instanceId,
            mode: this.resolveTrustMode(connection.allowSelfSigned ?? false, connection.certificatePem),
            certificatePem: connection.certificatePem,
          },
        });

        return updatedInstance;
      });

      await this.safeLogout(connection, session.sid);
      await this.audit.record({
        action: "instances.update",
        actorType: "session",
        ipAddress,
        targetType: "instance",
        targetId: updated.id,
        result: "SUCCESS",
        details: {
          baseUrl: updated.baseUrl,
          name: updated.name,
          version: version.summary,
        } satisfies Prisma.InputJsonObject,
      });

      return {
        instance: {
          id: updated.id,
          name: updated.name,
          baseUrl: updated.baseUrl,
          version: version.summary,
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

      this.mapPiholeError(error);
    }
  }

  async testInstance(instanceId: string, request: Request) {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        secret: true,
        certificateTrust: true,
      },
    });

    if (!instance || !instance.secret) {
      throw new NotFoundException("Instance not found.");
    }

    const connection = {
      baseUrl: instance.baseUrl,
      allowSelfSigned: instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: instance.certificateTrust?.certificatePem ?? null,
    };
    const ipAddress = getRequestIp(request);

    try {
      const session = await this.pihole.authenticate(
        connection,
        this.crypto.decryptSecret(instance.secret.encryptedPassword),
      );
      const health = await this.pihole.healthCheck(connection, session);

      await this.prisma.instance.update({
        where: { id: instanceId },
        data: {
          lastKnownVersion: health.version,
          lastValidatedAt: new Date(),
        },
      });

      await this.safeLogout(connection, session.sid);
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

      this.mapPiholeError(error);
    }
  }

  private async safeLogout(
    connection: { baseUrl: string; allowSelfSigned: boolean; certificatePem?: string | null },
    sid: string,
  ) {
    try {
      await this.pihole.logout(connection, sid);
    } catch {
      // Service-session cleanup is best-effort.
    }
  }

  private mapPiholeError(error: unknown): never {
    if (error instanceof PiholeRequestError && error.statusCode === 401) {
      throw new UnauthorizedException("The Pi-hole credentials are invalid.");
    }

    if (error instanceof PiholeRequestError) {
      throw new BadGatewayException(`Failed to reach the Pi-hole instance: ${error.message}`);
    }

    throw error;
  }

  private resolveTrustMode(allowSelfSigned: boolean, certificatePem?: string | null): CertificateTrustMode {
    if (certificatePem) {
      return "CUSTOM_CA";
    }

    return allowSelfSigned ? "ALLOW_SELF_SIGNED" : "STRICT";
  }
}
