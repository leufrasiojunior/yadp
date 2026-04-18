import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  PreconditionFailedException,
} from "@nestjs/common";
import { Cron, CronExpression, Interval } from "@nestjs/schedule";
import webpush from "web-push";

import { CryptoService } from "../common/crypto/crypto.service";
import { DEFAULT_API_LOCALE } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { AppEnvService } from "../config/app-env";
import { BACKEND_CONFIG } from "../config/backend-config";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { PiholeInfoMessage, PiholeManagedInstanceSummary, PiholeRequestErrorKind } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { GetNotificationsDto } from "./dto/get-notifications.dto";
import type { GetNotificationsPreviewDto } from "./dto/get-notifications-preview.dto";
import type { UpsertPushSubscriptionDto } from "./dto/upsert-push-subscription.dto";
import type {
  NotificationItem,
  NotificationMutationResponse,
  NotificationReadState,
  NotificationSource,
  NotificationsListResponse,
  NotificationsPreviewResponse,
  PushPublicKeyResponse,
  PushSubscriptionResponse,
  SystemNotificationType,
} from "./notifications.types";
import { createHash } from "node:crypto";

type NotificationRecord = Awaited<ReturnType<PrismaService["notification"]["findFirstOrThrow"]>>;

type AuditFailureEntry = {
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  details?: Prisma.InputJsonValue;
};

type SystemNotificationInput = {
  type: SystemNotificationType;
  fingerprint: string;
  message: string;
  instanceId?: string | null;
  instanceName?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
  incrementOccurrence?: boolean;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  source: "env" | "database";
};

const PIHOLE_TYPE_SET = new Set(BACKEND_CONFIG.notifications.piholeMessageTypes);
const NOTIFICATION_PAGE_SIZE_MAX = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readFailedInstanceEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const instanceId = readString(item.instanceId);
      const instanceName = readString(item.instanceName);
      const kind = readString(item.kind) || "unknown";
      const message = readString(item.message);

      if (instanceId.length === 0 || instanceName.length === 0 || message.length === 0) {
        return null;
      }

      return {
        instanceId,
        instanceName,
        kind,
        message,
      };
    })
    .filter(
      (item): item is { instanceId: string; instanceName: string; kind: string; message: string } => item !== null,
    );
}

function notificationVisibilityWhere(): Prisma.NotificationWhereInput {
  return {
    hiddenAt: null,
    resolvedAt: null,
  };
}

function notificationReadStateWhere(readState: NotificationReadState): Prisma.NotificationWhereInput {
  return {
    isRead: readState === "read",
  };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pollFingerprints = new Map<string, string>();
  private vapidConfig: VapidConfig | null;
  private syncInProgress = false;

  constructor(
    @Inject(AppEnvService) private readonly env: AppEnvService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    this.vapidConfig = this.resolveEnvVapidConfig();
  }

  async onModuleInit() {
    await this.ensureVapidConfig();
    void this.runScheduledSync("startup");
  }

  @Interval(BACKEND_CONFIG.notifications.pollIntervalMs)
  handleNotificationsInterval() {
    void this.runScheduledSync("interval");
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  handleRetentionCleanup() {
    void this.deleteExpiredNotifications();
  }

  async listNotifications(query: GetNotificationsDto): Promise<NotificationsListResponse> {
    const pageSize = Math.max(1, Math.min(query.pageSize, NOTIFICATION_PAGE_SIZE_MAX));
    const page = Math.max(1, query.page);
    const where = {
      ...notificationVisibilityWhere(),
      ...notificationReadStateWhere(query.readState),
    } satisfies Prisma.NotificationWhereInput;
    const unreadWhere = {
      ...notificationVisibilityWhere(),
      isRead: false,
    } satisfies Prisma.NotificationWhereInput;
    const [items, totalItems, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: unreadWhere }),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      items: items.map((item) => this.mapNotificationItem(item)),
      pagination: {
        page: Math.min(page, totalPages),
        pageSize,
        totalItems,
        totalPages,
      },
      unreadCount,
      readState: query.readState,
    };
  }

  async getPreview(query: GetNotificationsPreviewDto): Promise<NotificationsPreviewResponse> {
    const limit = Math.max(1, Math.min(query.limit, 20));
    const where = {
      ...notificationVisibilityWhere(),
      isRead: false,
    } satisfies Prisma.NotificationWhereInput;
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      this.prisma.notification.count({
        where,
      }),
    ]);

    return {
      items: items.map((item) => this.mapNotificationItem(item)),
      unreadCount,
      push: {
        available: this.vapidConfig !== null,
      },
    };
  }

  async markAsRead(id: string): Promise<NotificationMutationResponse> {
    const notification = await this.requireNotification(id);

    if (notification.isRead) {
      return { notification: this.mapNotificationItem(notification) };
    }

    await this.deletePiholeNotificationFromSource(notification);
    const now = new Date();

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: now,
        ...(this.isRemotelyManagedPiholeNotification(notification) ? { deleteRequestedAt: now } : {}),
      },
    });

    return {
      notification: this.mapNotificationItem(updated),
    };
  }

  async markAllAsRead() {
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        ...notificationVisibilityWhere(),
        isRead: false,
      },
    });
    const piholeNotifications = unreadNotifications.filter((notification) =>
      this.isRemotelyManagedPiholeNotification(notification),
    );
    const successfulRemoteDeleteIds = await this.deletePiholeNotificationsFromSource(piholeNotifications);
    const readableIds = unreadNotifications
      .filter(
        (notification) =>
          notification.source !== "PIHOLE" ||
          !this.isRemotelyManagedPiholeNotification(notification) ||
          successfulRemoteDeleteIds.has(notification.id),
      )
      .map((notification) => notification.id);

    if (readableIds.length === 0) {
      return {
        updatedCount: 0,
      };
    }

    const now = new Date();
    const updated = await this.prisma.notification.updateMany({
      where: {
        id: {
          in: readableIds,
        },
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });
    const remotelyDeletedIds = [...successfulRemoteDeleteIds];

    if (remotelyDeletedIds.length > 0) {
      await this.prisma.notification.updateMany({
        where: {
          id: {
            in: remotelyDeletedIds,
          },
        },
        data: {
          deleteRequestedAt: now,
        },
      });
    }

    return {
      updatedCount: updated.count,
    };
  }

  async hideNotification(id: string): Promise<NotificationMutationResponse> {
    const notification = await this.requireNotification(id);
    const now = new Date();

    await this.deletePiholeNotificationFromSource(notification);

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        hiddenAt: now,
        ...(notification.source === "PIHOLE"
          ? {
              deleteRequestedAt: now,
              resolvedAt: notification.resolvedAt ?? now,
              state: "RESOLVED",
            }
          : {}),
      },
    });

    return {
      notification: this.mapNotificationItem(updated),
    };
  }

  getPushPublicKey(): PushPublicKeyResponse {
    return {
      available: this.vapidConfig !== null,
      publicKey: this.vapidConfig?.publicKey ?? null,
      source: this.vapidConfig?.source ?? null,
    };
  }

  async upsertPushSubscription(body: UpsertPushSubscriptionDto): Promise<PushSubscriptionResponse> {
    if (!this.vapidConfig) {
      throw new PreconditionFailedException(translateApi(DEFAULT_API_LOCALE, "notifications.pushUnavailable"));
    }

    const endpoint = body.endpoint.trim();

    if (endpoint.length === 0) {
      throw new BadRequestException(translateApi(DEFAULT_API_LOCALE, "notifications.pushEndpointRequired"));
    }

    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent?.trim() || null,
        disabledAt: null,
      },
      create: {
        endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent?.trim() || null,
      },
    });

    return {
      ok: true,
      available: true,
      endpoint,
    };
  }

  async deletePushSubscription(endpoint: string | null): Promise<PushSubscriptionResponse> {
    const normalizedEndpoint = endpoint?.trim() ?? "";

    if (normalizedEndpoint.length === 0) {
      throw new BadRequestException(translateApi(DEFAULT_API_LOCALE, "notifications.pushEndpointRequired"));
    }

    await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint: normalizedEndpoint,
      },
    });

    return {
      ok: true,
      available: this.vapidConfig !== null,
      endpoint: normalizedEndpoint,
    };
  }

  async recordSystemEvent(input: SystemNotificationInput) {
    const existing = await this.prisma.notification.findFirst({
      where: {
        source: "SYSTEM",
        sourceFingerprint: input.fingerprint,
        hiddenAt: null,
        resolvedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
    });
    const now = new Date();

    if (existing) {
      const updated = await this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          type: input.type,
          message: input.message,
          instanceId: input.instanceId ?? null,
          instanceNameSnapshot: input.instanceName ?? null,
          metadata: input.metadata,
          lastSeenAt: now,
          occurredAt: input.incrementOccurrence === false ? existing.occurredAt : (input.occurredAt ?? now),
          occurrenceCount:
            input.incrementOccurrence === false ? existing.occurrenceCount : existing.occurrenceCount + 1,
        },
      });

      return updated;
    }

    const created = await this.prisma.notification.create({
      data: {
        source: "SYSTEM",
        type: input.type,
        instanceId: input.instanceId ?? null,
        instanceNameSnapshot: input.instanceName ?? null,
        message: input.message,
        metadata: input.metadata,
        sourceFingerprint: input.fingerprint,
        firstSeenAt: now,
        lastSeenAt: now,
        occurredAt: input.occurredAt ?? now,
        occurrenceCount: 1,
      },
    });

    await this.sendPushForNotification(created);
    return created;
  }

  async resolveSystemNotification(fingerprint: string) {
    await this.prisma.notification.updateMany({
      where: {
        source: "SYSTEM",
        sourceFingerprint: fingerprint,
        hiddenAt: null,
        resolvedAt: null,
      },
      data: {
        state: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  }

  async recordAuditFailure(entry: AuditFailureEntry) {
    const details = isRecord(entry.details) ? (entry.details as Record<string, unknown>) : null;
    const failedInstances = readFailedInstanceEntries(details?.failedInstances);
    const type = this.mapAuditActionType(entry.action);

    if (failedInstances.length > 0) {
      await Promise.all(
        failedInstances.map((failure) =>
          this.recordSystemEvent({
            type,
            fingerprint: `audit:${entry.action}:${entry.targetId ?? "-"}:${failure.instanceId}:${failure.kind}:${failure.message}`,
            message: failure.message,
            instanceId: failure.instanceId,
            instanceName: failure.instanceName,
            metadata: {
              action: entry.action,
              targetId: entry.targetId ?? null,
              targetType: entry.targetType ?? null,
              kind: failure.kind,
            } satisfies Prisma.InputJsonObject,
          }),
        ),
      );

      return;
    }

    const errorMessage = details ? readString(details.error) : "";

    if (errorMessage.length === 0) {
      return;
    }

    await this.recordSystemEvent({
      type,
      fingerprint: `audit:${entry.action}:${entry.targetId ?? "-"}:${errorMessage}`,
      message: errorMessage,
      metadata: {
        action: entry.action,
        targetId: entry.targetId ?? null,
        targetType: entry.targetType ?? null,
      } satisfies Prisma.InputJsonObject,
    });
  }

  private async runScheduledSync(trigger: string) {
    if (this.syncInProgress) {
      this.logger.debug(`Skipping notifications sync "${trigger}" because another run is still active.`);
      return;
    }

    this.syncInProgress = true;
    this.logger.debug(`Starting notifications sync (${trigger}).`);

    try {
      await this.syncPiholeMessages();
      await this.syncInstanceSessionNotifications();
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncPiholeMessages() {
    const instances = await this.instanceSessions.listInstanceSummaries();

    await Promise.all(
      instances.map(async (instance) => {
        const syncErrorFingerprint = this.getInstancePollFingerprint(instance.id);

        try {
          const result = await this.instanceSessions.withActiveSession(
            instance.id,
            DEFAULT_API_LOCALE,
            ({ connection, session }) => this.pihole.listInfoMessages(connection, session),
          );
          const activeFingerprints = new Set<string>();

          for (const message of result.messages) {
            if (
              !PIHOLE_TYPE_SET.has(message.type as (typeof BACKEND_CONFIG.notifications.piholeMessageTypes)[number])
            ) {
              continue;
            }

            const fingerprint = await this.recordPiholeMessage(instance, message);
            activeFingerprints.add(fingerprint);
          }

          await this.resolveMissingPiholeMessages(instance.id, activeFingerprints);
          await this.resolveSystemNotification(syncErrorFingerprint);
        } catch (error) {
          const failure = this.mapNotificationFailure(instance, error);
          await this.recordSystemEvent({
            type: "NOTIFICATION_SYNC_ERROR",
            fingerprint: syncErrorFingerprint,
            message: failure.message,
            instanceId: instance.id,
            instanceName: instance.name,
            metadata: {
              kind: failure.kind,
              baseUrl: instance.baseUrl,
            } satisfies Prisma.InputJsonObject,
            incrementOccurrence: false,
          });
        }
      }),
    );
  }

  private async syncInstanceSessionNotifications() {
    const instances = await this.prisma.instance.findMany({
      select: {
        id: true,
        name: true,
        session: {
          select: {
            lastErrorKind: true,
            lastErrorMessage: true,
          },
        },
      },
    });

    await Promise.all(
      instances.map(async (instance) => {
        const fingerprint = `system:instance-session:${instance.id}`;
        const message = readString(instance.session?.lastErrorMessage);

        if (message.length === 0) {
          await this.resolveSystemNotification(fingerprint);
          return;
        }

        await this.recordSystemEvent({
          type: "INSTANCE_SESSION_ERROR",
          fingerprint,
          message,
          instanceId: instance.id,
          instanceName: instance.name,
          metadata: {
            kind: readString(instance.session?.lastErrorKind) || null,
          } satisfies Prisma.InputJsonObject,
          incrementOccurrence: false,
        });
      }),
    );
  }

  private async deleteExpiredNotifications() {
    const cutoff = new Date(Date.now() - BACKEND_CONFIG.notifications.retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    this.logger.debug(`Deleted ${result.count} expired notification record(s).`);
  }

  private isRemotelyManagedPiholeNotification(notification: NotificationRecord) {
    return (
      notification.source === "PIHOLE" &&
      Boolean(notification.instanceId) &&
      Boolean(notification.sourceExternalId) &&
      notification.hiddenAt === null
    );
  }

  private async deletePiholeNotificationFromSource(notification: NotificationRecord) {
    if (!this.isRemotelyManagedPiholeNotification(notification)) {
      return;
    }

    await this.instanceSessions.withActiveSession(
      notification.instanceId as string,
      DEFAULT_API_LOCALE,
      async ({ connection, session }) => {
        await this.pihole.deleteInfoMessage(connection, session, notification.sourceExternalId as string);
      },
    );
  }

  private async deletePiholeNotificationsFromSource(notifications: NotificationRecord[]) {
    if (notifications.length === 0) {
      return new Set<string>();
    }

    const groupedNotifications = new Map<string, NotificationRecord[]>();

    for (const notification of notifications) {
      if (!notification.instanceId) {
        continue;
      }

      const current = groupedNotifications.get(notification.instanceId) ?? [];
      current.push(notification);
      groupedNotifications.set(notification.instanceId, current);
    }

    const successfulIds = await Promise.all(
      [...groupedNotifications.entries()].map(async ([instanceId, entries]) => {
        try {
          return await this.instanceSessions.withActiveSession(
            instanceId,
            DEFAULT_API_LOCALE,
            async ({ connection, session }) => {
              const groupSuccess: string[] = [];

              for (const notification of entries) {
                try {
                  await this.pihole.deleteInfoMessage(connection, session, notification.sourceExternalId as string);
                  groupSuccess.push(notification.id);
                } catch (error) {
                  this.logger.warn(
                    `Failed to delete Pi-hole notification ${notification.id} while marking all as read: ${
                      error instanceof Error ? error.message : "unknown error"
                    }`,
                  );
                }
              }

              return groupSuccess;
            },
          );
        } catch (error) {
          this.logger.warn(
            `Failed to open Pi-hole session for bulk mark-as-read on instance ${instanceId}: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
          return [];
        }
      }),
    );

    return new Set(successfulIds.flat());
  }

  private async recordPiholeMessage(instance: PiholeManagedInstanceSummary, message: PiholeInfoMessage) {
    const fingerprint = `pihole:${instance.id}:${message.id}`;
    const existing = await this.prisma.notification.findFirst({
      where: {
        source: "PIHOLE",
        sourceFingerprint: fingerprint,
        hiddenAt: null,
        resolvedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
    });
    const occurredAt = new Date(message.timestamp * 1000);
    const now = new Date();

    if (existing) {
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          message: message.plain,
          instanceNameSnapshot: instance.name,
          lastSeenAt: now,
          metadata: {
            html: message.html,
          } satisfies Prisma.InputJsonObject,
        },
      });

      return fingerprint;
    }

    const created = await this.prisma.notification.create({
      data: {
        source: "PIHOLE",
        type: message.type,
        instanceId: instance.id,
        instanceNameSnapshot: instance.name,
        message: message.plain,
        metadata: {
          html: message.html,
        } satisfies Prisma.InputJsonObject,
        sourceFingerprint: fingerprint,
        sourceExternalId: `${message.id}`,
        firstSeenAt: now,
        lastSeenAt: now,
        occurredAt,
      },
    });

    await this.sendPushForNotification(created);
    return fingerprint;
  }

  private async resolveMissingPiholeMessages(instanceId: string, activeFingerprints: Set<string>) {
    const active = await this.prisma.notification.findMany({
      where: {
        source: "PIHOLE",
        instanceId,
        hiddenAt: null,
        resolvedAt: null,
      },
      select: {
        id: true,
        sourceFingerprint: true,
      },
    });
    const now = new Date();

    const missingIds = active.filter((item) => !activeFingerprints.has(item.sourceFingerprint)).map((item) => item.id);

    if (missingIds.length === 0) {
      return;
    }

    await this.prisma.notification.updateMany({
      where: {
        id: {
          in: missingIds,
        },
      },
      data: {
        state: "RESOLVED",
        resolvedAt: now,
      },
    });
  }

  private async sendPushForNotification(notification: NotificationRecord) {
    if (!this.vapidConfig || notification.hiddenAt || notification.resolvedAt) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        disabledAt: null,
      },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const title = notification.instanceNameSnapshot?.trim().length
      ? `${notification.type} - ${notification.instanceNameSnapshot}`
      : notification.type;
    const payload = JSON.stringify({
      title,
      body: notification.message,
      data: {
        url: "/notifications",
        notificationId: notification.id,
      },
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload,
          );

          await this.prisma.pushSubscription.update({
            where: { endpoint: subscription.endpoint },
            data: {
              lastSuccessAt: new Date(),
              lastFailureAt: null,
              failureCount: 0,
            },
          });
        } catch (error) {
          const statusCode = this.readPushFailureStatusCode(error);
          const endpointDiagnostic = this.buildEndpointDiagnostic(subscription.endpoint);
          this.logger.warn(
            `Failed to send push notification to ${endpointDiagnostic} (status: ${statusCode ?? "unknown"}): ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
          await this.prisma.pushSubscription.update({
            where: { endpoint: subscription.endpoint },
            data: {
              lastFailureAt: new Date(),
              failureCount: {
                increment: 1,
              },
              ...(statusCode === 404 || statusCode === 410 ? { disabledAt: new Date() } : {}),
            },
          });
        }
      }),
    );
  }

  private readPushFailureStatusCode(error: unknown) {
    if (!isRecord(error)) {
      return null;
    }

    const statusCode = error.statusCode;
    return typeof statusCode === "number" ? statusCode : null;
  }

  private buildEndpointDiagnostic(endpoint: string) {
    const hash = createHash("sha256").update(endpoint).digest("hex").slice(0, 12);
    return `subscription#${hash}`;
  }

  private mapNotificationItem(record: NotificationRecord): NotificationItem {
    return {
      id: record.id,
      source: record.source as NotificationSource,
      type: record.type,
      instanceId: record.instanceId ?? null,
      instanceName: record.instanceNameSnapshot ?? null,
      message: record.message,
      state: record.state,
      isRead: record.isRead,
      readAt: record.readAt?.toISOString() ?? null,
      hiddenAt: record.hiddenAt?.toISOString() ?? null,
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      occurredAt: record.occurredAt.toISOString(),
      lastSeenAt: record.lastSeenAt.toISOString(),
      occurrenceCount: record.occurrenceCount,
      canDeleteRemotely: record.source === "PIHOLE" && Boolean(record.instanceId && record.sourceExternalId),
    };
  }

  private async requireNotification(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(translateApi(DEFAULT_API_LOCALE, "notifications.notFound"));
    }

    return notification;
  }

  private mapAuditActionType(action: string): SystemNotificationType {
    if (action.startsWith("clients.")) {
      return "CLIENTS_FAILURE";
    }

    if (action.startsWith("domains.")) {
      return "DOMAINS_FAILURE";
    }

    if (action.startsWith("groups.")) {
      return "GROUPS_FAILURE";
    }

    if (action.startsWith("instances.")) {
      return "INSTANCES_FAILURE";
    }

    if (action.startsWith("lists.")) {
      return "LISTS_FAILURE";
    }

    if (action.startsWith("sync.")) {
      return "SYNC_FAILURE";
    }

    return "SYSTEM_FAILURE";
  }

  private mapNotificationFailure(instance: PiholeManagedInstanceSummary, error: unknown) {
    if (error instanceof PiholeRequestError) {
      return {
        kind: error.kind,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        kind: "unknown" as PiholeRequestErrorKind,
        message: error.message,
      };
    }

    return {
      kind: "unknown" as PiholeRequestErrorKind,
      message: translateApi(DEFAULT_API_LOCALE, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private getInstancePollFingerprint(instanceId: string) {
    const cached = this.pollFingerprints.get(instanceId);

    if (cached) {
      return cached;
    }

    const fingerprint = `system:notifications-sync:${instanceId}`;
    this.pollFingerprints.set(instanceId, fingerprint);
    return fingerprint;
  }

  private resolveEnvVapidConfig(): VapidConfig | null {
    const publicKey = this.env.values.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
    const privateKey = this.env.values.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
    const subject = this.env.values.WEB_PUSH_VAPID_SUBJECT.trim();

    if (publicKey && privateKey) {
      return {
        publicKey,
        privateKey,
        subject,
        source: "env",
      };
    }

    if (publicKey || privateKey) {
      this.logger.warn(
        "WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY must both be set. Falling back to persisted database configuration.",
      );
    }

    return null;
  }

  private async ensureVapidConfig() {
    if (this.vapidConfig) {
      this.applyVapidConfig(this.vapidConfig);
      return this.vapidConfig;
    }

    const subject = this.env.values.WEB_PUSH_VAPID_SUBJECT.trim();
    const appConfig = await this.prisma.appConfig.findUnique({
      where: { id: "singleton" },
    });
    const persistedPublicKey = appConfig?.webPushVapidPublicKey?.trim();
    const persistedPrivateKeyEncrypted = appConfig?.webPushVapidPrivateKeyEncrypted?.trim();
    const persistedSubject = appConfig?.webPushVapidSubject?.trim() || subject;

    if (persistedPublicKey && persistedPrivateKeyEncrypted) {
      const resolved = {
        publicKey: persistedPublicKey,
        privateKey: this.crypto.decryptSecret(persistedPrivateKeyEncrypted),
        subject: persistedSubject,
        source: "database" as const,
      };

      this.applyVapidConfig(resolved);
      this.vapidConfig = resolved;
      return resolved;
    }

    const generated = webpush.generateVAPIDKeys();
    const created = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
      source: "database" as const,
    };

    await this.prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: {
        webPushVapidPublicKey: created.publicKey,
        webPushVapidPrivateKeyEncrypted: this.crypto.encryptSecret(created.privateKey),
        webPushVapidSubject: created.subject,
      },
      create: {
        id: "singleton",
        webPushVapidPublicKey: created.publicKey,
        webPushVapidPrivateKeyEncrypted: this.crypto.encryptSecret(created.privateKey),
        webPushVapidSubject: created.subject,
      },
    });
    this.logger.log("Generated and persisted a new VAPID key pair for web push notifications.");

    this.applyVapidConfig(created);
    this.vapidConfig = created;
    return created;
  }

  private applyVapidConfig(vapidConfig: VapidConfig) {
    webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);
  }
}
