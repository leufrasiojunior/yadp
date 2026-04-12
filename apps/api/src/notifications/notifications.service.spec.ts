import { NotificationsService } from "./notifications.service";
import assert from "node:assert/strict";
import test from "node:test";

type NotificationRecord = {
  id: string;
  source: "PIHOLE" | "SYSTEM";
  type: string;
  instanceId: string | null;
  instanceNameSnapshot: string | null;
  message: string;
  metadata: unknown;
  state: "ACTIVE" | "RESOLVED";
  isRead: boolean;
  readAt: Date | null;
  hiddenAt: Date | null;
  resolvedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurredAt: Date;
  occurrenceCount: number;
  sourceFingerprint: string;
  sourceExternalId: string | null;
  deleteRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function compareValues(left: unknown, right: unknown) {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;

  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue! > rightValue! ? 1 : -1;
}

function matchesWhere(item: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      if ("in" in value && Array.isArray(value.in)) {
        return value.in.includes(item[key]);
      }

      if ("lt" in value && value.lt instanceof Date) {
        const current = item[key];
        return current instanceof Date && current.getTime() < value.lt.getTime();
      }
    }

    return item[key] === value;
  });
}

function sortRecords<T extends Record<string, unknown>>(
  items: T[],
  orderBy: Array<Record<string, "asc" | "desc">> | undefined,
) {
  if (!orderBy || orderBy.length === 0) {
    return [...items];
  }

  return [...items].sort((left, right) => {
    for (const entry of orderBy) {
      const [key, direction] = Object.entries(entry)[0] ?? [];

      if (!key || !direction) {
        continue;
      }

      const result = compareValues(left[key], right[key]);

      if (result !== 0) {
        return direction === "desc" ? -result : result;
      }
    }

    return 0;
  });
}

function projectRecord<T extends Record<string, unknown>>(item: T, select: Record<string, boolean> | undefined) {
  if (!select) {
    return cloneRecord(item);
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, cloneRecord(item[key as keyof T])]),
  );
}

function applyData<T extends Record<string, unknown>>(target: T, data: Record<string, unknown>) {
  const next = { ...target };

  for (const [key, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      "increment" in value
    ) {
      const current = typeof next[key] === "number" ? (next[key] as number) : 0;
      next[key] = current + (value.increment as number);
      continue;
    }

    next[key] = value;
  }

  next.updatedAt = new Date();
  return next;
}

function makeNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  const now = new Date("2026-04-09T10:00:00.000Z");

  return {
    id: overrides.id ?? `notification-${Math.random().toString(36).slice(2, 10)}`,
    source: overrides.source ?? "SYSTEM",
    type: overrides.type ?? "SYSTEM_FAILURE",
    instanceId: overrides.instanceId ?? null,
    instanceNameSnapshot: overrides.instanceNameSnapshot ?? null,
    message: overrides.message ?? "Mensagem",
    metadata: overrides.metadata ?? null,
    state: overrides.state ?? "ACTIVE",
    isRead: overrides.isRead ?? false,
    readAt: overrides.readAt ?? null,
    hiddenAt: overrides.hiddenAt ?? null,
    resolvedAt: overrides.resolvedAt ?? null,
    firstSeenAt: overrides.firstSeenAt ?? now,
    lastSeenAt: overrides.lastSeenAt ?? now,
    occurredAt: overrides.occurredAt ?? now,
    occurrenceCount: overrides.occurrenceCount ?? 1,
    sourceFingerprint: overrides.sourceFingerprint ?? `fingerprint-${Math.random().toString(36).slice(2, 10)}`,
    sourceExternalId: overrides.sourceExternalId ?? null,
    deleteRequestedAt: overrides.deleteRequestedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createPrismaStub(
  seed: {
    notifications?: NotificationRecord[];
    pushSubscriptions?: PushSubscriptionRecord[];
    instances?: Array<Record<string, unknown>>;
  } = {},
) {
  const notifications = seed.notifications ? [...seed.notifications] : [];
  const pushSubscriptions = seed.pushSubscriptions ? [...seed.pushSubscriptions] : [];
  const instances = seed.instances ? [...seed.instances] : [];

  return {
    notification: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
      }) => {
        const result = sortRecords(
          notifications.filter((item) => matchesWhere(item, where)),
          orderBy,
        )[0];

        return result ? cloneRecord(result) : null;
      },
      findMany: async ({
        where,
        orderBy,
        skip,
        take,
        select,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
        skip?: number;
        take?: number;
        select?: Record<string, boolean>;
      }) => {
        const ordered = sortRecords(
          notifications.filter((item) => matchesWhere(item, where)),
          orderBy,
        );
        const sliced = ordered.slice(skip ?? 0, typeof take === "number" ? (skip ?? 0) + take : undefined);
        return sliced.map((item) => projectRecord(item, select));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const result = notifications.find((item) => item.id === where.id);
        return result ? cloneRecord(result) : null;
      },
      create: async ({ data }: { data: Partial<NotificationRecord> }) => {
        const created = makeNotification(data);
        notifications.push(created);
        return cloneRecord(created);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = notifications.findIndex((item) => item.id === where.id);

        if (index === -1) {
          throw new Error(`Missing notification ${where.id}`);
        }

        notifications[index] = applyData(notifications[index], data);
        return cloneRecord(notifications[index]);
      },
      updateMany: async ({ where, data }: { where?: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;

        for (let index = 0; index < notifications.length; index += 1) {
          if (!matchesWhere(notifications[index], where)) {
            continue;
          }

          notifications[index] = applyData(notifications[index], data);
          count += 1;
        }

        return { count };
      },
      count: async ({ where }: { where?: Record<string, unknown> }) =>
        notifications.filter((item) => matchesWhere(item, where)).length,
      deleteMany: async ({ where }: { where?: Record<string, unknown> }) => {
        const originalLength = notifications.length;
        const kept = notifications.filter((item) => !matchesWhere(item, where));
        notifications.splice(0, notifications.length, ...kept);
        return { count: originalLength - kept.length };
      },
    },
    pushSubscription: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        pushSubscriptions.filter((item) => matchesWhere(item, where)).map((item) => cloneRecord(item)),
      update: async ({ where, data }: { where: { endpoint: string }; data: Record<string, unknown> }) => {
        const index = pushSubscriptions.findIndex((item) => item.endpoint === where.endpoint);

        if (index === -1) {
          throw new Error(`Missing push subscription ${where.endpoint}`);
        }

        pushSubscriptions[index] = applyData(pushSubscriptions[index], data);
        return cloneRecord(pushSubscriptions[index]);
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { endpoint: string };
        create: Partial<PushSubscriptionRecord>;
        update: Record<string, unknown>;
      }) => {
        const existingIndex = pushSubscriptions.findIndex((item) => item.endpoint === where.endpoint);

        if (existingIndex >= 0) {
          pushSubscriptions[existingIndex] = applyData(pushSubscriptions[existingIndex], update);
          return cloneRecord(pushSubscriptions[existingIndex]);
        }

        const now = new Date();
        const created: PushSubscriptionRecord = {
          endpoint: create.endpoint as string,
          p256dh: create.p256dh as string,
          auth: create.auth as string,
          userAgent: (create.userAgent as string | null | undefined) ?? null,
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCount: 0,
          disabledAt: null,
          createdAt: now,
          updatedAt: now,
        };
        pushSubscriptions.push(created);
        return cloneRecord(created);
      },
      deleteMany: async ({ where }: { where?: Record<string, unknown> }) => {
        const originalLength = pushSubscriptions.length;
        const kept = pushSubscriptions.filter((item) => !matchesWhere(item, where));
        pushSubscriptions.splice(0, pushSubscriptions.length, ...kept);
        return { count: originalLength - kept.length };
      },
    },
    instance: {
      findMany: async () => cloneRecord(instances),
    },
    __state: {
      notifications,
      pushSubscriptions,
    },
  };
}

function createService(seed: Parameters<typeof createPrismaStub>[0] = {}) {
  const prisma = createPrismaStub(seed);
  const deleteCalls: string[] = [];
  const sessions = {
    listInstanceSummaries: async () => [],
    withActiveSession: async (
      _instanceId: string,
      _locale: string,
      handler: (ctx: { connection: object; session: object }) => Promise<unknown>,
    ) => handler({ connection: {}, session: {} }),
  };
  const pihole = {
    listInfoMessages: async () => ({ messages: [] }),
    deleteInfoMessage: async (_connection: object, _session: object, messageId: string) => {
      deleteCalls.push(messageId);
    },
  };
  const env = {
    values: {
      WEB_PUSH_VAPID_SUBJECT: "mailto:test@yapd.local",
      WEB_PUSH_VAPID_PUBLIC_KEY: "",
      WEB_PUSH_VAPID_PRIVATE_KEY: "",
    },
  };

  return {
    service: new NotificationsService(env as never, sessions as never, pihole as never, prisma as never),
    prisma,
    sessions,
    pihole,
    deleteCalls,
  };
}

test("deduplica mensagens do Pi-hole pelo fingerprint entre polls", async () => {
  const { service, prisma } = createService();
  const instance = {
    id: "instance-1",
    name: "Pi-hole Casa",
    baseUrl: "https://pi.hole",
  };
  const message = {
    id: 42,
    type: "RATE_LIMIT",
    plain: "Primeira versão",
    html: "<p>Primeira versão</p>",
    timestamp: 1_712_654_400,
  };

  await service["recordPiholeMessage"](instance as never, message as never);
  await service["recordPiholeMessage"](instance as never, { ...message, plain: "Atualizada" } as never);

  assert.equal(prisma.__state.notifications.length, 1);
  assert.equal(prisma.__state.notifications[0]?.sourceFingerprint, "pihole:instance-1:42");
  assert.equal(prisma.__state.notifications[0]?.message, "Atualizada");
});

test("marca como resolvidas mensagens do Pi-hole que sumiram na origem", async () => {
  const active = makeNotification({
    id: "active-1",
    source: "PIHOLE",
    type: "RATE_LIMIT",
    instanceId: "instance-1",
    instanceNameSnapshot: "Pi-hole Casa",
    sourceFingerprint: "pihole:instance-1:42",
    sourceExternalId: "42",
  });
  const preserved = makeNotification({
    id: "active-2",
    source: "PIHOLE",
    type: "CONNECTION_ERROR",
    instanceId: "instance-1",
    instanceNameSnapshot: "Pi-hole Casa",
    sourceFingerprint: "pihole:instance-1:43",
    sourceExternalId: "43",
  });
  const { service, prisma } = createService({
    notifications: [active, preserved],
  });

  await service["resolveMissingPiholeMessages"]("instance-1", new Set(["pihole:instance-1:43"]));

  assert.equal(prisma.__state.notifications[0]?.state, "RESOLVED");
  assert.ok(prisma.__state.notifications[0]?.resolvedAt instanceof Date);
  assert.equal(prisma.__state.notifications[1]?.state, "ACTIVE");
  assert.equal(prisma.__state.notifications[1]?.resolvedAt, null);
});

test("DELETE de notificação Pi-hole apaga na origem e só então oculta localmente", async () => {
  const notification = makeNotification({
    id: "notification-1",
    source: "PIHOLE",
    type: "RATE_LIMIT",
    instanceId: "instance-1",
    instanceNameSnapshot: "Pi-hole Casa",
    sourceFingerprint: "pihole:instance-1:42",
    sourceExternalId: "42",
  });
  const { service, prisma, deleteCalls } = createService({
    notifications: [notification],
  });

  const result = await service.hideNotification("notification-1");

  assert.deepEqual(deleteCalls, ["42"]);
  assert.ok(prisma.__state.notifications[0]?.hiddenAt instanceof Date);
  assert.equal(prisma.__state.notifications[0]?.state, "RESOLVED");
  assert.equal(result.notification.canDeleteRemotely, true);
});

test("markAsRead de notificação Pi-hole envia delete remoto antes de persistir a leitura", async () => {
  const notification = makeNotification({
    id: "notification-read-1",
    source: "PIHOLE",
    type: "RATE_LIMIT",
    instanceId: "instance-1",
    instanceNameSnapshot: "Pi-hole Casa",
    sourceFingerprint: "pihole:instance-1:77",
    sourceExternalId: "77",
  });
  const { service, prisma, deleteCalls } = createService({
    notifications: [notification],
  });

  const result = await service.markAsRead("notification-read-1");

  assert.deepEqual(deleteCalls, ["77"]);
  assert.equal(result.notification.isRead, true);
  assert.ok(prisma.__state.notifications[0]?.readAt instanceof Date);
  assert.ok(prisma.__state.notifications[0]?.deleteRequestedAt instanceof Date);
});

test("falha ao apagar na origem mantém a notificação visível", async () => {
  const notification = makeNotification({
    id: "notification-2",
    source: "PIHOLE",
    type: "RATE_LIMIT",
    instanceId: "instance-1",
    instanceNameSnapshot: "Pi-hole Casa",
    sourceFingerprint: "pihole:instance-1:99",
    sourceExternalId: "99",
  });
  const { service, prisma, pihole } = createService({
    notifications: [notification],
  });

  pihole.deleteInfoMessage = async () => {
    throw new Error("remote delete failed");
  };

  await assert.rejects(() => service.hideNotification("notification-2"), /remote delete failed/);
  assert.equal(prisma.__state.notifications[0]?.hiddenAt, null);
  assert.equal(prisma.__state.notifications[0]?.state, "ACTIVE");
});

test("listNotifications filtra por readState e mantém ocultas fora das abas", async () => {
  const { service } = createService({
    notifications: [
      makeNotification({
        id: "unread-1",
        isRead: false,
        sourceFingerprint: "system:unread-1",
        occurredAt: new Date("2026-04-09T10:01:00.000Z"),
      }),
      makeNotification({
        id: "read-1",
        isRead: true,
        readAt: new Date("2026-04-09T10:02:00.000Z"),
        sourceFingerprint: "system:read-1",
        occurredAt: new Date("2026-04-09T10:02:00.000Z"),
      }),
      makeNotification({
        id: "hidden-read",
        isRead: true,
        readAt: new Date("2026-04-09T10:03:00.000Z"),
        hiddenAt: new Date("2026-04-09T10:04:00.000Z"),
        sourceFingerprint: "system:hidden-read",
        occurredAt: new Date("2026-04-09T10:03:00.000Z"),
      }),
    ],
  });

  const unreadList = await service.listNotifications({ page: 1, pageSize: 10, readState: "unread" });
  const readList = await service.listNotifications({ page: 1, pageSize: 10, readState: "read" });

  assert.deepEqual(
    unreadList.items.map((item) => item.id),
    ["unread-1"],
  );
  assert.equal(unreadList.pagination.totalItems, 1);
  assert.equal(unreadList.unreadCount, 1);
  assert.equal(unreadList.readState, "unread");

  assert.deepEqual(
    readList.items.map((item) => item.id),
    ["read-1"],
  );
  assert.equal(readList.pagination.totalItems, 1);
  assert.equal(readList.unreadCount, 1);
  assert.equal(readList.readState, "read");
});

test("preview mostra 5 itens visíveis mais recentes e markAllRead zera o contador", async () => {
  const notifications = Array.from({ length: 6 }, (_, index) =>
    makeNotification({
      id: `notification-${index + 1}`,
      source: index === 5 ? "PIHOLE" : "SYSTEM",
      type: index === 5 ? "RATE_LIMIT" : "SYSTEM_FAILURE",
      message: `Mensagem ${index + 1}`,
      occurredAt: new Date(Date.UTC(2026, 3, 9, 10, index, 0)),
      createdAt: new Date(Date.UTC(2026, 3, 9, 10, index, 0)),
      lastSeenAt: new Date(Date.UTC(2026, 3, 9, 10, index, 0)),
      sourceFingerprint: `system:${index + 1}`,
      instanceId: index === 5 ? "instance-1" : null,
      instanceNameSnapshot: index === 5 ? "Pi-hole Casa" : null,
      sourceExternalId: index === 5 ? "6" : null,
    }),
  );
  notifications.push(
    makeNotification({
      id: "hidden-item",
      hiddenAt: new Date("2026-04-09T11:00:00.000Z"),
      sourceFingerprint: "system:hidden",
    }),
    makeNotification({
      id: "resolved-item",
      resolvedAt: new Date("2026-04-09T11:05:00.000Z"),
      state: "RESOLVED",
      sourceFingerprint: "system:resolved",
    }),
    makeNotification({
      id: "already-read",
      isRead: true,
      readAt: new Date("2026-04-09T11:06:00.000Z"),
      sourceFingerprint: "system:already-read",
      occurredAt: new Date("2026-04-09T11:06:00.000Z"),
    }),
  );
  const { service, deleteCalls, prisma } = createService({ notifications });

  const preview = await service.getPreview({ limit: 5 });

  assert.equal(preview.unreadCount, 6);
  assert.equal(preview.items.length, 5);
  assert.deepEqual(
    preview.items.map((item) => item.id),
    ["notification-6", "notification-5", "notification-4", "notification-3", "notification-2"],
  );

  const readAll = await service.markAllAsRead();
  const afterRead = await service.getPreview({ limit: 5 });

  assert.equal(readAll.updatedCount, 6);
  assert.equal(afterRead.unreadCount, 0);
  assert.deepEqual(deleteCalls, ["6"]);
  assert.ok(
    prisma.__state.notifications.find((item) => item.id === "notification-6")?.deleteRequestedAt instanceof Date,
  );
});

test("mesmo fingerprint de sistema atualiza enquanto ativo e cria novo registro após resolução", async () => {
  const { service, prisma } = createService();

  await service.recordSystemEvent({
    type: "SYSTEM_FAILURE",
    fingerprint: "system:sync",
    message: "Falhou",
  });
  await service.recordSystemEvent({
    type: "SYSTEM_FAILURE",
    fingerprint: "system:sync",
    message: "Falhou de novo",
  });

  assert.equal(prisma.__state.notifications.length, 1);
  assert.equal(prisma.__state.notifications[0]?.message, "Falhou de novo");

  await service.resolveSystemNotification("system:sync");
  await service.recordSystemEvent({
    type: "SYSTEM_FAILURE",
    fingerprint: "system:sync",
    message: "Voltou a falhar",
  });

  assert.equal(prisma.__state.notifications.length, 2);
  assert.equal(prisma.__state.notifications[1]?.message, "Voltou a falhar");
  assert.equal(prisma.__state.notifications[1]?.isRead, false);
});
