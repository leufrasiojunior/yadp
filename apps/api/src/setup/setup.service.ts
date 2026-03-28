import { BadGatewayException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { PrismaService } from "../common/prisma/prisma.service";
import type { CertificateTrustMode, Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { CreateBaselineDto } from "./dto/create-baseline.dto";

@Injectable()
export class SetupService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getStatus() {
    const baseline = await this.prisma.instance.findFirst({
      where: { isBaseline: true },
    });

    return {
      needsSetup: !baseline,
      baselineConfigured: Boolean(baseline),
      baseline: baseline
        ? {
            id: baseline.id,
            name: baseline.name,
            baseUrl: baseline.baseUrl,
          }
        : null,
    };
  }

  async createBaseline(dto: CreateBaselineDto, request: Request) {
    const existingBaseline = await this.prisma.instance.findFirst({
      where: { isBaseline: true },
    });

    if (existingBaseline) {
      throw new ConflictException("A baseline instance is already configured.");
    }

    const connection = {
      baseUrl: dto.baseUrl,
      allowSelfSigned: dto.allowSelfSigned ?? false,
      certificatePem: dto.certificatePem ?? null,
    };
    const ipAddress = getRequestIp(request);

    try {
      const session = await this.pihole.authenticate(connection, dto.servicePassword, dto.totp);
      const version = await this.pihole.readCapabilities(connection, session);

      const instance = await this.prisma.$transaction(async (tx) => {
        const createdInstance = await tx.instance.create({
          data: {
            name: dto.name,
            baseUrl: dto.baseUrl,
            isBaseline: true,
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

      await this.audit.record({
        action: "setup.baseline.create",
        actorType: "bootstrap",
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

      await this.safeLogout(connection, session.sid);

      return {
        baseline: {
          id: instance.id,
          name: instance.name,
          baseUrl: instance.baseUrl,
          version: version.summary,
        },
      };
    } catch (error) {
      await this.audit.record({
        action: "setup.baseline.create",
        actorType: "bootstrap",
        ipAddress,
        targetType: "instance",
        result: "FAILURE",
        details: {
          baseUrl: dto.baseUrl,
          name: dto.name,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      if (error instanceof PiholeRequestError && error.statusCode === 401) {
        throw new UnauthorizedException("The provided Pi-hole credentials are invalid.");
      }

      if (error instanceof PiholeRequestError) {
        throw new BadGatewayException(`Failed to validate the baseline Pi-hole: ${error.message}`);
      }

      throw error;
    }
  }

  private async safeLogout(
    connection: { baseUrl: string; allowSelfSigned: boolean; certificatePem?: string | null },
    sid: string,
  ) {
    try {
      await this.pihole.logout(connection, sid);
    } catch {
      // Session cleanup is best-effort during setup.
    }
  }

  private resolveTrustMode(allowSelfSigned: boolean, certificatePem?: string | null): CertificateTrustMode {
    if (certificatePem) {
      return "CUSTOM_CA";
    }

    return allowSelfSigned ? "ALLOW_SELF_SIGNED" : "STRICT";
  }
}
