import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { CryptoService } from "../common/crypto/crypto.service";
import type { ApiLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { InstanceSessionAuthSource } from "../common/prisma/prisma-client";
import { normalizeManagedInstanceBaseUrl } from "../common/url/managed-instance-base-url";
import { PiholeRequestError, PiholeService } from "./pihole.service";
import type {
  PiholeAuthSessionRecord,
  PiholeConnection,
  PiholeManagedInstanceSummary,
  PiholeRequestErrorKind,
  PiholeSession,
} from "./pihole.types";
import { PiholeWorkCoordinatorService } from "./pihole-work-coordinator.service";

export const INSTANCE_SESSION_STATUS_VALUES = ["active", "expired", "missing", "error"] as const;

export type InstanceSessionStatus = (typeof INSTANCE_SESSION_STATUS_VALUES)[number];

export type InstanceSessionManagedBy = "human-master" | "stored-secret";

export type InstanceSessionSummary = {
  status: InstanceSessionStatus;
  managedBy: InstanceSessionManagedBy | null;
  loginAt: string | null;
  lastActiveAt: string | null;
  validUntil: string | null;
  lastErrorKind: PiholeRequestErrorKind | null;
  lastErrorMessage: string | null;
};

export type InstanceSessionFailure = {
  instanceId: string;
  instanceName: string;
  kind: PiholeRequestErrorKind;
  message: string;
};

export type InstanceSessionBootstrapResult = {
  successfulInstances: Array<{
    instanceId: string;
    instanceName: string;
  }>;
  failedInstances: InstanceSessionFailure[];
};

export type ActiveInstanceSessionContext = {
  instance: PiholeManagedInstanceSummary;
  connection: PiholeConnection;
  session: Pick<PiholeSession, "sid" | "csrf">;
  summary: InstanceSessionSummary;
  authSource: InstanceSessionAuthSource;
};

type InstanceRecord = {
  id: string;
  name: string;
  baseUrl: string;
  isBaseline: boolean;
  syncEnabled: boolean;
  certificateTrust: {
    mode: string;
    certificatePem: string | null;
  } | null;
  secret: {
    encryptedPassword: string;
  } | null;
  session: {
    encryptedSid: string;
    encryptedCsrf: string;
    piholeSessionId: number | null;
    loginAt: Date | null;
    lastActiveAt: Date | null;
    validUntil: Date | null;
    authSource: InstanceSessionAuthSource;
    lastErrorKind: string | null;
    lastErrorMessage: string | null;
    lastErrorAt: Date | null;
  } | null;
};

type PersistedSessionSecret = {
  sid: string;
  csrf: string;
};

type SeededSessionInput = {
  session: Pick<PiholeSession, "sid" | "csrf">;
  authSource: InstanceSessionAuthSource;
};

type ReauthenticateOptions = {
  authSource?: InstanceSessionAuthSource;
  passwordOverride?: string;
  totp?: string;
};

type ManagedInstanceAccessOptions = {
  allowDisabled?: boolean;
};

type ManagedInstanceListOptions = {
  includeDisabled?: boolean;
};

const PIHOLE_SESSION_ACTIVITY_WINDOW_MS = 30 * 60 * 1000;
const PIHOLE_SESSION_REVALIDATION_BUFFER_MS = 2 * 60 * 1000;

@Injectable()
export class PiholeInstanceSessionService {
  private readonly logger = new Logger(PiholeInstanceSessionService.name);

  constructor(
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PiholeWorkCoordinatorService) private readonly coordinator: PiholeWorkCoordinatorService,
  ) {}

  async listInstanceSummaries(options?: ManagedInstanceListOptions): Promise<PiholeManagedInstanceSummary[]> {
    const instances = await this.prisma.instance.findMany({
      ...(options?.includeDisabled ? {} : { where: { syncEnabled: true } }),
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
      },
    });

    return instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
    }));
  }

  async getInstanceSummary(
    instanceId: string,
    locale: ApiLocale,
    options?: ManagedInstanceAccessOptions,
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

    this.assertInstanceEnabledForOperation(instance, locale, options);

    return {
      id: instance.id,
      name: instance.name,
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
    };
  }

  async listInstanceStates(): Promise<
    Array<{
      instanceId: string;
      summary: InstanceSessionSummary;
    }>
  > {
    const instances = await this.prisma.instance.findMany({
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      include: {
        session: true,
      },
    });

    return instances.map((instance) => ({
      instanceId: instance.id,
      summary: this.mapStoredSessionSummary(instance.session),
    }));
  }

  async bootstrapAllSessions(
    locale: ApiLocale,
    options?: {
      seededSessions?: Record<string, SeededSessionInput>;
    },
  ): Promise<InstanceSessionBootstrapResult> {
    const instances = await this.loadAllManagedInstances();
    const seededSessions = options?.seededSessions ?? {};
    const successfulInstances: InstanceSessionBootstrapResult["successfulInstances"] = [];
    const failedInstances: InstanceSessionBootstrapResult["failedInstances"] = [];

    const settled = await Promise.allSettled(
      instances.map(async (instance) => {
        const seeded = seededSessions[instance.id];

        if (seeded) {
          await this.seedSessionFromLogin(instance.id, locale, seeded.session, seeded.authSource);
          return instance;
        }

        await this.ensureActiveSession(instance.id, locale);
        return instance;
      }),
    );

    settled.forEach((result, index) => {
      const instance = instances[index];

      if (!instance) {
        return;
      }

      if (result.status === "fulfilled") {
        successfulInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
        });
        return;
      }

      failedInstances.push(this.mapFailure(instance, result.reason, locale));
    });

    return {
      successfulInstances,
      failedInstances,
    };
  }

  async seedSessionFromLogin(
    instanceId: string,
    locale: ApiLocale,
    session: Pick<PiholeSession, "sid" | "csrf">,
    authSource: InstanceSessionAuthSource,
    options?: ManagedInstanceAccessOptions,
  ) {
    return this.runForManagedInstance(
      instanceId,
      locale,
      "session.seed",
      (instance) => this.persistExistingSessionUnsafe(instance, locale, session, authSource),
      options,
    );
  }

  async ensureActiveSession(
    instanceId: string,
    locale: ApiLocale,
    options?: ManagedInstanceAccessOptions,
  ): Promise<ActiveInstanceSessionContext> {
    return this.runForManagedInstance(
      instanceId,
      locale,
      "session.ensure",
      (instance) => this.ensureActiveSessionUnsafe(instance, locale),
      options,
    );
  }

  async forceReauthenticate(
    instanceId: string,
    locale: ApiLocale,
    options?: ManagedInstanceAccessOptions,
  ): Promise<ActiveInstanceSessionContext> {
    return this.runForManagedInstance(
      instanceId,
      locale,
      "session.reauthenticate",
      (instance) =>
        this.authenticateAndPersist(instance, locale, {
          authSource: instance.session?.authSource ?? "STORED_SECRET",
        }),
      options,
    );
  }

  async withActiveSession<T>(
    instanceId: string,
    locale: ApiLocale,
    execute: (context: ActiveInstanceSessionContext) => Promise<T>,
    options?: ManagedInstanceAccessOptions,
  ): Promise<T> {
    return this.runForManagedInstance(
      instanceId,
      locale,
      "session.active",
      async (instance) => {
        let context = await this.ensureActiveSessionUnsafe(instance, locale);
        this.logger.verbose(
          `Executing authenticated Pi-hole work for "${context.instance.name}" (${context.instance.id}) using baseUrl=${context.instance.baseUrl}.`,
        );

        try {
          const result = await execute(context);
          await this.refreshSessionLease(context.instance.id);
          this.logger.verbose(
            `Authenticated Pi-hole work completed successfully for "${context.instance.name}" (${context.instance.id}).`,
          );
          return result;
        } catch (error) {
          if (!this.shouldReauthenticate(error)) {
            const failure = this.mapFailure(context.instance, error, locale);
            await this.recordSessionError(context.instance.id, failure.kind, failure.message);
            this.logger.warn(
              `Authenticated Pi-hole work failed for "${context.instance.name}" (${context.instance.id}) without reauthentication. kind=${failure.kind} message="${failure.message}"`,
            );
            throw error;
          }

          this.logger.warn(
            `Authenticated Pi-hole request for "${context.instance.name}" failed with auth error. Reauthenticating once.`,
          );
          const reauthenticationInstance = await this.loadManagedInstance(instanceId, locale, options);
          context = await this.authenticateAndPersist(reauthenticationInstance, locale, {
            authSource: context.authSource,
          });

          const result = await execute(context);
          await this.refreshSessionLease(context.instance.id);
          return result;
        }
      },
      options,
    );
  }

  private async ensureActiveSessionUnsafe(
    instance: InstanceRecord,
    locale: ApiLocale,
  ): Promise<ActiveInstanceSessionContext> {
    if (!instance.session) {
      this.logger.debug(`No persisted Pi-hole session for "${instance.name}". Authenticating with stored secret.`);
      return this.authenticateAndPersist(instance, locale, {
        authSource: "STORED_SECRET",
      });
    }

    const secret = this.decryptStoredSession(instance.session);
    const connection = this.buildConnection(instance, locale);

    if (this.isStoredSessionReusableWithoutRevalidation(instance.session)) {
      this.logger.debug(`Reusing cached Pi-hole session for "${instance.name}" without /auth/sessions revalidation.`);
      return {
        instance: this.toInstanceSummary(instance),
        connection,
        session: secret,
        summary: this.mapStoredSessionSummary(instance.session),
        authSource: instance.session.authSource,
      };
    }

    try {
      const currentSession = await this.pihole.getCurrentSessionDetails(connection, secret);

      if (!currentSession || !currentSession.valid || currentSession.validUntil * 1000 <= Date.now()) {
        this.logger.warn(`Persisted Pi-hole session for "${instance.name}" is no longer valid. Reauthenticating.`);
        return this.authenticateAndPersist(instance, locale, {
          authSource: instance.session.authSource,
        });
      }

      const updated = await this.persistValidatedSession(
        instance.id,
        secret,
        instance.session.authSource,
        currentSession,
        null,
      );

      return {
        instance: this.toInstanceSummary(instance),
        connection,
        session: secret,
        summary: this.mapStoredSessionSummary(updated),
        authSource: instance.session.authSource,
      };
    } catch (error) {
      if (this.shouldReauthenticate(error)) {
        this.logger.warn(`Persisted Pi-hole session for "${instance.name}" returned auth failure. Reauthenticating.`);
        return this.authenticateAndPersist(instance, locale, {
          authSource: instance.session.authSource,
        });
      }

      if (this.isStoredSessionStillLocallyValid(instance.session)) {
        this.logger.warn(
          `Could not revalidate Pi-hole session for "${instance.name}", but the stored lease is still locally valid. Reusing cached session.`,
        );
        return {
          instance: this.toInstanceSummary(instance),
          connection,
          session: secret,
          summary: this.mapStoredSessionSummary(instance.session),
          authSource: instance.session.authSource,
        };
      }

      const failure = this.mapFailure(instance, error, locale);
      await this.recordSessionError(instance.id, failure.kind, failure.message);
      throw error;
    }
  }

  private async runForManagedInstance<T>(
    instanceId: string,
    locale: ApiLocale,
    operation: string,
    execute: (instance: InstanceRecord) => Promise<T>,
    options?: ManagedInstanceAccessOptions,
  ) {
    const instance = await this.loadManagedInstance(instanceId, locale, options);
    const connection = this.buildConnection(instance, locale);

    return this.coordinator.runForInstance(instance.id, connection, operation, async () => {
      const latestInstance = await this.loadManagedInstance(instanceId, locale, options);
      return execute(latestInstance);
    });
  }

  private async authenticateAndPersist(
    instance: InstanceRecord,
    locale: ApiLocale,
    options?: ReauthenticateOptions,
  ): Promise<ActiveInstanceSessionContext> {
    if (!instance.secret) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    const connection = this.buildConnection(instance, locale);
    const previousSession = instance.session;
    const password = options?.passwordOverride ?? this.crypto.decryptSecret(instance.secret.encryptedPassword);
    const authSource = options?.authSource ?? previousSession?.authSource ?? "STORED_SECRET";
    const authenticated = await this.pihole.authenticate(connection, password, options?.totp);
    const session: PersistedSessionSecret = {
      sid: authenticated.sid,
      csrf: authenticated.csrf,
    };
    const metadata = await this.pihole.getCurrentSessionDetails(connection, session);

    if (!metadata) {
      throw new PiholeRequestError(
        502,
        translateApi(locale, "pihole.invalidResponse", {
          baseUrl: instance.baseUrl,
          path: "/auth/sessions",
        }),
        "pihole_response_error",
      );
    }

    const stored = await this.persistValidatedSession(instance.id, session, authSource, metadata, null);
    await this.deletePreviousSessionBestEffort(connection, session, previousSession, metadata.id);

    return {
      instance: this.toInstanceSummary(instance),
      connection,
      session,
      summary: this.mapStoredSessionSummary(stored),
      authSource,
    };
  }

  private async persistExistingSessionUnsafe(
    instance: InstanceRecord,
    locale: ApiLocale,
    session: Pick<PiholeSession, "sid" | "csrf">,
    authSource: InstanceSessionAuthSource,
  ): Promise<ActiveInstanceSessionContext> {
    const connection = this.buildConnection(instance, locale);
    const metadata = await this.pihole.getCurrentSessionDetails(connection, session);

    if (!metadata) {
      throw new PiholeRequestError(
        502,
        translateApi(locale, "pihole.invalidResponse", {
          baseUrl: instance.baseUrl,
          path: "/auth/sessions",
        }),
        "pihole_response_error",
      );
    }

    const stored = await this.persistValidatedSession(instance.id, session, authSource, metadata, null);

    return {
      instance: this.toInstanceSummary(instance),
      connection,
      session,
      summary: this.mapStoredSessionSummary(stored),
      authSource,
    };
  }

  private async persistValidatedSession(
    instanceId: string,
    session: PersistedSessionSecret,
    authSource: InstanceSessionAuthSource,
    metadata: PiholeAuthSessionRecord,
    lastError: { kind: PiholeRequestErrorKind; message: string } | null,
  ) {
    return this.prisma.instanceSession.upsert({
      where: { instanceId },
      update: {
        encryptedSid: this.crypto.encryptSecret(session.sid),
        encryptedCsrf: this.crypto.encryptSecret(session.csrf),
        piholeSessionId: metadata.id,
        loginAt: new Date(metadata.loginAt * 1000),
        lastActiveAt: new Date(metadata.lastActive * 1000),
        validUntil: new Date(metadata.validUntil * 1000),
        authSource,
        lastErrorKind: lastError?.kind ?? null,
        lastErrorMessage: lastError?.message ?? null,
        lastErrorAt: lastError ? new Date() : null,
      },
      create: {
        instanceId,
        encryptedSid: this.crypto.encryptSecret(session.sid),
        encryptedCsrf: this.crypto.encryptSecret(session.csrf),
        piholeSessionId: metadata.id,
        loginAt: new Date(metadata.loginAt * 1000),
        lastActiveAt: new Date(metadata.lastActive * 1000),
        validUntil: new Date(metadata.validUntil * 1000),
        authSource,
        lastErrorKind: lastError?.kind ?? null,
        lastErrorMessage: lastError?.message ?? null,
        lastErrorAt: lastError ? new Date() : null,
      },
    });
  }

  private async recordSessionError(instanceId: string, kind: PiholeRequestErrorKind, message: string) {
    const existing = await this.prisma.instanceSession.findUnique({
      where: { instanceId },
    });

    if (!existing) {
      return;
    }

    await this.prisma.instanceSession.update({
      where: { instanceId },
      data: {
        lastErrorKind: kind,
        lastErrorMessage: message,
        lastErrorAt: new Date(),
      },
    });
  }

  private async refreshSessionLease(instanceId: string) {
    const existing = await this.prisma.instanceSession.findUnique({
      where: { instanceId },
      select: {
        instanceId: true,
      },
    });

    if (!existing) {
      return;
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + PIHOLE_SESSION_ACTIVITY_WINDOW_MS);

    await this.prisma.instanceSession.update({
      where: { instanceId },
      data: {
        lastActiveAt: now,
        validUntil,
        lastErrorKind: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });
  }

  private shouldReauthenticate(error: unknown) {
    return error instanceof PiholeRequestError && (error.statusCode === 401 || error.statusCode === 403);
  }

  private isStoredSessionReusableWithoutRevalidation(session: NonNullable<InstanceRecord["session"]>) {
    const validUntil = session.validUntil?.getTime();

    if (!validUntil) {
      return false;
    }

    return validUntil - Date.now() > PIHOLE_SESSION_REVALIDATION_BUFFER_MS;
  }

  private isStoredSessionStillLocallyValid(session: NonNullable<InstanceRecord["session"]>) {
    const validUntil = session.validUntil?.getTime();

    if (!validUntil) {
      return false;
    }

    return validUntil > Date.now();
  }

  private async deletePreviousSessionBestEffort(
    connection: PiholeConnection,
    currentSession: PersistedSessionSecret,
    previousSession: InstanceRecord["session"],
    currentSessionId: number,
  ) {
    if (!previousSession?.piholeSessionId || previousSession.piholeSessionId === currentSessionId) {
      return;
    }

    try {
      await this.pihole.deleteSessionById(connection, currentSession, previousSession.piholeSessionId);
    } catch {
      this.logger.warn(
        `Failed to invalidate previous Pi-hole session "${previousSession.piholeSessionId}" for ${connection.baseUrl}.`,
      );
    }
  }

  private mapFailure(
    instance: Pick<InstanceRecord, "id" | "name" | "baseUrl">,
    error: unknown,
    locale: ApiLocale,
  ): InstanceSessionFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: "unknown",
        message: error.message,
      };
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown",
      message: translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private buildConnection(
    instance: Pick<InstanceRecord, "baseUrl" | "certificateTrust">,
    locale: ApiLocale,
  ): PiholeConnection {
    return {
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
      allowSelfSigned: instance.certificateTrust?.mode === "ALLOW_SELF_SIGNED",
      certificatePem: instance.certificateTrust?.certificatePem ?? null,
      locale,
    };
  }

  private decryptStoredSession(session: NonNullable<InstanceRecord["session"]>): PersistedSessionSecret {
    return {
      sid: this.crypto.decryptSecret(session.encryptedSid),
      csrf: this.crypto.decryptSecret(session.encryptedCsrf),
    };
  }

  private toInstanceSummary(instance: Pick<InstanceRecord, "id" | "name" | "baseUrl">): PiholeManagedInstanceSummary {
    return {
      id: instance.id,
      name: instance.name,
      baseUrl: normalizeManagedInstanceBaseUrl(instance.baseUrl),
    };
  }

  private mapStoredSessionSummary(session: InstanceRecord["session"]): InstanceSessionSummary {
    if (!session) {
      return {
        status: "missing",
        managedBy: null,
        loginAt: null,
        lastActiveAt: null,
        validUntil: null,
        lastErrorKind: null,
        lastErrorMessage: null,
      };
    }

    const validUntil = session.validUntil?.getTime() ?? null;
    const hasError = Boolean(session.lastErrorKind && session.lastErrorMessage);
    const status: InstanceSessionStatus =
      validUntil === null ? "missing" : validUntil <= Date.now() ? "expired" : hasError ? "error" : "active";

    return {
      status,
      managedBy: session.authSource === "HUMAN_MASTER" ? "human-master" : "stored-secret",
      loginAt: session.loginAt?.toISOString() ?? null,
      lastActiveAt: session.lastActiveAt?.toISOString() ?? null,
      validUntil: session.validUntil?.toISOString() ?? null,
      lastErrorKind: this.normalizeStoredErrorKind(session.lastErrorKind),
      lastErrorMessage: session.lastErrorMessage,
    };
  }

  private normalizeStoredErrorKind(value: string | null): PiholeRequestErrorKind | null {
    switch (value) {
      case "invalid_credentials":
      case "tls_error":
      case "timeout":
      case "dns_error":
      case "connection_refused":
      case "pihole_response_error":
      case "unknown":
        return value;
      default:
        return null;
    }
  }

  private async loadAllManagedInstances(options?: ManagedInstanceListOptions): Promise<InstanceRecord[]> {
    return this.prisma.instance.findMany({
      ...(options?.includeDisabled ? {} : { where: { syncEnabled: true } }),
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      include: {
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
        session: {
          select: {
            encryptedSid: true,
            encryptedCsrf: true,
            piholeSessionId: true,
            loginAt: true,
            lastActiveAt: true,
            validUntil: true,
            authSource: true,
            lastErrorKind: true,
            lastErrorMessage: true,
            lastErrorAt: true,
          },
        },
      },
    });
  }

  private async loadManagedInstance(
    instanceId: string,
    locale: ApiLocale,
    options?: ManagedInstanceAccessOptions,
  ): Promise<InstanceRecord> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
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
        session: {
          select: {
            encryptedSid: true,
            encryptedCsrf: true,
            piholeSessionId: true,
            loginAt: true,
            lastActiveAt: true,
            validUntil: true,
            authSource: true,
            lastErrorKind: true,
            lastErrorMessage: true,
            lastErrorAt: true,
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(translateApi(locale, "instances.notFound"));
    }

    this.assertInstanceEnabledForOperation(instance, locale, options);

    return instance;
  }

  private assertInstanceEnabledForOperation(
    instance: Pick<InstanceRecord, "syncEnabled">,
    locale: ApiLocale,
    options?: ManagedInstanceAccessOptions,
  ) {
    if (!options?.allowDisabled && !instance.syncEnabled) {
      throw new BadRequestException(translateApi(locale, "instances.disabledForSync"));
    }
  }
}
