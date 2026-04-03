import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { CryptoService } from "../common/crypto/crypto.service";
import type { ApiLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import { normalizeManagedInstanceBaseUrl } from "../common/url/managed-instance-base-url";
import { PiholeService } from "./pihole.service";
import type { PiholeConnection, PiholeManagedInstanceSummary, PiholeSession } from "./pihole.types";
import { PiholeWorkCoordinatorService } from "./pihole-work-coordinator.service";

type ManagedInstanceRecord = {
  id: string;
  name: string;
  baseUrl: string;
  syncEnabled: boolean;
  certificateTrust: {
    mode: string;
    certificatePem: string | null;
  } | null;
  secret: {
    encryptedPassword: string;
  };
};

@Injectable()
export class PiholeInstanceConnectorService {
  private readonly logger = new Logger(PiholeInstanceConnectorService.name);

  constructor(
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PiholeWorkCoordinatorService) private readonly coordinator: PiholeWorkCoordinatorService,
  ) {}

  async listInstanceSummaries(options?: { includeDisabled?: boolean }): Promise<PiholeManagedInstanceSummary[]> {
    const instances = await this.prisma.instance.findMany({
      ...(options?.includeDisabled ? {} : { where: { syncEnabled: true } }),
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
      },
    });

    this.logger.debug(`Loaded ${instances.length} managed Pi-hole instance summary record(s).`);

    return instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
    }));
  }

  async getInstanceSummary(
    instanceId: string,
    locale: ApiLocale,
    options?: { allowDisabled?: boolean },
  ): Promise<PiholeManagedInstanceSummary> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        syncEnabled: true,
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    if (!options?.allowDisabled && !instance.syncEnabled) {
      throw new BadRequestException(translateApi(locale, "instances.disabledForSync"));
    }

    return {
      id: instance.id,
      name: instance.name,
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
    };
  }

  async withAuthenticatedSession<T>(
    instanceId: string,
    locale: ApiLocale,
    execute: (context: {
      instance: PiholeManagedInstanceSummary;
      connection: PiholeConnection;
      session: Pick<PiholeSession, "sid" | "csrf">;
    }) => Promise<T>,
  ): Promise<T> {
    const instance = await this.getManagedInstance(instanceId, locale);
    const connection = this.buildConnection(instance);
    return this.coordinator.runForInstance(instance.id, connection, "session.technical", async () => {
      this.logger.debug(`Authenticating technical session for instance "${instance.name}" (${instance.baseUrl}).`);
      const session = await this.pihole.authenticate(
        connection,
        this.crypto.decryptSecret(instance.secret.encryptedPassword),
      );

      try {
        this.logger.verbose(`Technical session established for instance "${instance.name}".`);
        return await execute({
          instance: {
            id: instance.id,
            name: instance.name,
            baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
          },
          connection,
          session: {
            sid: session.sid,
            csrf: session.csrf,
          },
        });
      } finally {
        await this.safeLogout(connection, session.sid);
      }
    });
  }

  private async getManagedInstance(instanceId: string, locale: ApiLocale): Promise<ManagedInstanceRecord> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        syncEnabled: true,
        certificateTrust: {
          select: {
            mode: true,
            certificatePem: true,
          },
        },
        secret: {
          select: {
            encryptedPassword: true,
          },
        },
      },
    });

    if (!instance || !instance.secret) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    if (!instance.syncEnabled) {
      throw new BadRequestException(translateApi(locale, "instances.disabledForSync"));
    }

    return {
      ...instance,
      secret: instance.secret,
    };
  }

  private buildConnection(instance: ManagedInstanceRecord): PiholeConnection {
    return {
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
      allowSelfSigned: instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: instance.certificateTrust?.certificatePem ?? null,
    };
  }

  private async safeLogout(connection: PiholeConnection, sid: string) {
    try {
      await this.pihole.logout(connection, sid);
    } catch {
      this.logger.warn(`Failed to logout technical session for "${connection.baseUrl}".`);
    }
  }
}
