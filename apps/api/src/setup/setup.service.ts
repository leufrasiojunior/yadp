import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { DEFAULT_APP_LOGIN_MODE, fromDbLoginMode, toDbLoginMode } from "../common/auth/login-mode";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { DEFAULT_API_TIME_ZONE, normalizeApiTimeZone } from "../common/i18n/time-zone";
import { PrismaService } from "../common/prisma/prisma.service";
import type { CertificateTrustMode, Prisma } from "../common/prisma/prisma-client";
import { isPrismaMissingModelTable } from "../common/prisma/prisma-errors";
import {
  InvalidManagedInstanceBaseUrlError,
  normalizeManagedInstanceBaseUrl,
} from "../common/url/managed-instance-base-url";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { PiholeConnection, PiholeSession } from "../pihole/pihole.types";
import { PiholeWorkCoordinatorService } from "../pihole/pihole-work-coordinator.service";
import type { CreateBaselineDto, SetupCredentialMode, SetupInstanceDto } from "./dto/create-baseline.dto";

type PreparedCredentials = {
  password: string;
};

type PreparedInstance = {
  index: number;
  label: string;
  name: string;
  baseUrl: string;
  isMaster: boolean;
  allowSelfSigned: boolean;
  credentials: PreparedCredentials;
};

type ValidatedInstance = PreparedInstance & {
  version: string;
};

@Injectable()
export class SetupService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PiholeWorkCoordinatorService) private readonly coordinator: PiholeWorkCoordinatorService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getStatus() {
    const baseline = await this.prisma.instance.findFirst({
      where: { isBaseline: true },
    });
    const appConfig = baseline ? await this.readAppConfigOrNull() : null;

    return {
      needsSetup: !baseline,
      baselineConfigured: Boolean(baseline),
      loginMode: baseline ? fromDbLoginMode(appConfig?.loginMode) : null,
      timeZone: this.resolveAppTimeZone(appConfig),
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
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const existingBaseline = await this.prisma.instance.findFirst({
      where: { isBaseline: true },
    });

    if (existingBaseline) {
      throw new ConflictException(translateApi(locale, "setup.alreadyConfigured"));
    }

    try {
      const preparedInstances = this.prepareInstances(dto, locale);
      const validatedInstances = await this.validateInstances(preparedInstances, locale);
      const baselineCandidate = validatedInstances.find((instance) => instance.isMaster);
      const passwordHash =
        dto.loginMode === "yapd-password"
          ? this.crypto.hashPassword(this.normalizeOptionalString(dto.yapdPassword) as string)
          : null;
      const timeZone = normalizeApiTimeZone(dto.timeZone, "");

      if (!baselineCandidate) {
        throw new BadRequestException(translateApi(locale, "setup.singleMasterRequired"));
      }

      if (timeZone.length === 0) {
        throw new BadRequestException(translateApi(locale, "setup.invalidTimeZone"));
      }

      const createdInstances = await this.prisma.$transaction(async (tx) => {
        const created = [];

        for (const instance of validatedInstances) {
          const createdInstance = await tx.instance.create({
            data: {
              name: instance.name,
              baseUrl: instance.baseUrl,
              isBaseline: instance.isMaster,
              lastKnownVersion: instance.version,
              lastValidatedAt: new Date(),
            },
          });

          await tx.instanceSecret.create({
            data: {
              instanceId: createdInstance.id,
              encryptedPassword: this.crypto.encryptSecret(instance.credentials.password),
            },
          });

          await tx.instanceCertificateTrust.create({
            data: {
              instanceId: createdInstance.id,
              mode: this.resolveTrustMode(instance.allowSelfSigned),
              certificatePem: null,
            },
          });

          created.push({
            ...createdInstance,
            version: instance.version,
          });
        }

        await tx.appConfig.upsert({
          where: { id: "singleton" },
          update: {
            loginMode: toDbLoginMode(dto.loginMode),
            passwordHash,
            timeZone,
          },
          create: {
            id: "singleton",
            loginMode: toDbLoginMode(dto.loginMode),
            passwordHash,
            timeZone,
          },
        });

        return created;
      });

      const baseline = createdInstances.find((instance) => instance.isBaseline);

      await this.audit.record({
        action: "setup.baseline.create",
        actorType: "bootstrap",
        ipAddress,
        targetType: "instance",
        targetId: baseline?.id ?? null,
        result: "SUCCESS",
        details: {
          baseline: baseline
            ? {
                id: baseline.id,
                name: baseline.name,
                baseUrl: baseline.baseUrl,
                version: baseline.version,
              }
            : null,
          createdCount: createdInstances.length,
          loginMode: dto.loginMode,
          timeZone,
          instances: createdInstances.map((instance) => ({
            id: instance.id,
            name: instance.name,
            baseUrl: instance.baseUrl,
            isBaseline: instance.isBaseline,
            version: instance.version,
          })),
        } satisfies Prisma.InputJsonObject,
      });

      return {
        message: translateApi(locale, "setup.batchCreated", {
          count: String(createdInstances.length),
        }),
        baseline: baseline
          ? {
              id: baseline.id,
              name: baseline.name,
              baseUrl: baseline.baseUrl,
              version: baseline.version,
            }
          : null,
        createdCount: createdInstances.length,
        loginMode: dto.loginMode,
        timeZone,
      };
    } catch (error) {
      await this.audit.record({
        action: "setup.baseline.create",
        actorType: "bootstrap",
        ipAddress,
        targetType: "instance",
        result: "FAILURE",
        details: {
          credentialsMode: dto.credentialsMode,
          loginMode: dto.loginMode,
          timeZone: this.normalizeOptionalString(dto.timeZone),
          instanceCount: dto.instances.length,
          instances: dto.instances.map((instance, index) => ({
            index: index + 1,
            name: this.normalizeOptionalString(instance.name),
            baseUrl: this.normalizeOptionalString(instance.baseUrl),
            isMaster: instance.isMaster ?? false,
          })),
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  private resolveAppTimeZone(appConfig: { timeZone?: string | null } | null) {
    return normalizeApiTimeZone(appConfig?.timeZone, DEFAULT_API_TIME_ZONE);
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

  private prepareInstances(dto: CreateBaselineDto, locale: ReturnType<typeof getRequestLocale>) {
    this.validateLoginMode(dto, locale);
    const masterCount = dto.instances.filter((instance) => instance.isMaster).length;

    if (masterCount !== 1) {
      throw new BadRequestException(translateApi(locale, "setup.singleMasterRequired"));
    }

    const preparedInstances: PreparedInstance[] = [];

    for (const [index, instance] of dto.instances.entries()) {
      const label = this.resolveInstanceLabel(locale, index, instance.name);
      const name = this.normalizeOptionalString(instance.name);
      const baseUrlInput = this.normalizeOptionalString(instance.baseUrl);
      const baseUrl = baseUrlInput ? this.normalizeConfiguredBaseUrl(baseUrlInput, locale) : undefined;
      const isMaster = instance.isMaster ?? false;
      const allowSelfSigned = instance.allowSelfSigned ?? false;

      if (!isMaster && this.isBlankOptionalInstance(instance, dto.credentialsMode)) {
        continue;
      }

      if (!name || !baseUrl) {
        if (isMaster) {
          throw new BadRequestException(translateApi(locale, "setup.masterIncomplete"));
        }

        throw new BadRequestException(
          translateApi(locale, "setup.instanceIncomplete", {
            instance: label,
          }),
        );
      }

      preparedInstances.push({
        index,
        label,
        name,
        baseUrl,
        isMaster,
        allowSelfSigned,
        credentials: this.resolveCredentials(dto, instance, label, locale),
      });
    }

    const master = preparedInstances.find((instance) => instance.isMaster);

    if (!master) {
      throw new BadRequestException(translateApi(locale, "setup.masterIncomplete"));
    }

    return preparedInstances;
  }

  private validateLoginMode(dto: CreateBaselineDto, locale: ReturnType<typeof getRequestLocale>) {
    const loginMode = dto.loginMode ?? DEFAULT_APP_LOGIN_MODE;

    if (loginMode !== "pihole-master" && loginMode !== "yapd-password") {
      throw new BadRequestException(translateApi(locale, "setup.loginModeRequired"));
    }

    if (loginMode === "yapd-password") {
      const password = this.normalizeOptionalString(dto.yapdPassword);

      if (!password) {
        throw new BadRequestException(translateApi(locale, "setup.yapdPasswordRequired"));
      }

      if (password.length < 8) {
        throw new BadRequestException(translateApi(locale, "setup.yapdPasswordTooShort"));
      }
    }
  }

  private resolveCredentials(
    dto: CreateBaselineDto,
    instance: SetupInstanceDto,
    label: string,
    locale: ReturnType<typeof getRequestLocale>,
  ): PreparedCredentials {
    if (dto.credentialsMode === "shared") {
      const password = this.normalizeOptionalString(dto.sharedPassword);

      if (!password) {
        throw new BadRequestException(translateApi(locale, "setup.sharedCredentialsRequired"));
      }

      return {
        password,
      };
    }

    const password = this.normalizeOptionalString(instance.password);

    if (!password) {
      throw new BadRequestException(
        translateApi(locale, "setup.instanceCredentialsRequired", {
          instance: label,
        }),
      );
    }

    return {
      password,
    };
  }

  private async validateInstances(
    instances: PreparedInstance[],
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<ValidatedInstance[]> {
    const validatedInstances: ValidatedInstance[] = [];

    for (const instance of instances) {
      const connection = {
        baseUrl: instance.baseUrl,
        allowSelfSigned: instance.allowSelfSigned,
        locale,
      } satisfies PiholeConnection;

      try {
        const version = await this.coordinator.runForConnection(connection, "setup.validate", async () => {
          let session: PiholeSession | null = null;

          try {
            session = await this.pihole.authenticate(connection, instance.credentials.password);
            return await this.pihole.readCapabilities(connection, session);
          } finally {
            if (session) {
              await this.safeLogout(connection, session.sid);
            }
          }
        });

        validatedInstances.push({
          ...instance,
          version: version.summary,
        });
      } catch (error) {
        throw this.toInstanceException(error, locale, instance.label);
      }
    }

    return validatedInstances;
  }

  private toInstanceException(error: unknown, locale: ReturnType<typeof getRequestLocale>, instanceLabel: string) {
    if (error instanceof PiholeRequestError && error.statusCode === 401) {
      return new UnauthorizedException(
        translateApi(locale, "setup.instanceValidationFailed", {
          instance: instanceLabel,
          message: translateApi(locale, "setup.invalidCredentials"),
        }),
      );
    }

    if (error instanceof PiholeRequestError) {
      return new BadGatewayException(
        translateApi(locale, "setup.instanceValidationFailed", {
          instance: instanceLabel,
          message: error.message,
        }),
      );
    }

    if (error instanceof Error) {
      return new BadGatewayException(
        translateApi(locale, "setup.instanceValidationFailed", {
          instance: instanceLabel,
          message: error.message,
        }),
      );
    }

    return new BadGatewayException(
      translateApi(locale, "setup.instanceValidationFailed", {
        instance: instanceLabel,
        message: translateApi(locale, "pihole.unreachable", {
          baseUrl: instanceLabel,
        }),
      }),
    );
  }

  private async safeLogout(connection: PiholeConnection, sid: string) {
    try {
      await this.pihole.logout(connection, sid);
    } catch {
      // Session cleanup is best-effort during setup.
    }
  }

  private resolveInstanceLabel(locale: ReturnType<typeof getRequestLocale>, index: number, name?: string) {
    return this.normalizeOptionalString(name)
      ? (this.normalizeOptionalString(name) as string)
      : translateApi(locale, "setup.instanceLabelFallback", {
          index: String(index + 1),
        });
  }

  private normalizeOptionalString(value: string | null | undefined) {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
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

  private isBlankOptionalInstance(instance: SetupInstanceDto, mode: SetupCredentialMode) {
    const hasName = Boolean(this.normalizeOptionalString(instance.name));
    const hasBaseUrl = Boolean(this.normalizeOptionalString(instance.baseUrl));
    const allowSelfSigned = instance.allowSelfSigned ?? false;

    if (mode === "shared") {
      return !hasName && !hasBaseUrl && !allowSelfSigned;
    }

    const hasPassword = Boolean(this.normalizeOptionalString(instance.password));

    return !hasName && !hasBaseUrl && !allowSelfSigned && !hasPassword;
  }

  private resolveTrustMode(allowSelfSigned: boolean): CertificateTrustMode {
    return allowSelfSigned ? "ALLOW_SELF_SIGNED" : "STRICT";
  }
}
