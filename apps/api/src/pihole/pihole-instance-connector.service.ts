import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { CryptoService } from "../common/crypto/crypto.service";
import type { ApiLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import { PiholeService } from "./pihole.service";
import type { PiholeConnection, PiholeManagedInstanceSummary, PiholeSession } from "./pihole.types";

type ManagedInstanceRecord = {
  id: string;
  name: string;
  baseUrl: string;
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
  ) {}

  async listInstanceSummaries(): Promise<PiholeManagedInstanceSummary[]> {
    const instances = await this.prisma.instance.findMany({
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
      baseUrl: instance.baseUrl,
    }));
  }

  async getInstanceSummary(instanceId: string, locale: ApiLocale): Promise<PiholeManagedInstanceSummary> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        name: true,
        baseUrl: true,
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    return {
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
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
          baseUrl: instance.baseUrl,
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
  }

  private async getManagedInstance(instanceId: string, locale: ApiLocale): Promise<ManagedInstanceRecord> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        name: true,
        baseUrl: true,
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

    return {
      ...instance,
      secret: instance.secret,
    };
  }

  private buildConnection(instance: ManagedInstanceRecord): PiholeConnection {
    return {
      baseUrl: instance.baseUrl,
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
