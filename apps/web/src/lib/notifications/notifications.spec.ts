import type { NotificationItem } from "@/lib/api/yapd-types";

import { ptBRMessages } from "../i18n/messages.pt-br";
import { getNotificationTitle } from "./notifications";
import assert from "node:assert/strict";
import test from "node:test";

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notification-1",
    source: "SYSTEM",
    type: "INSTANCE_SESSION_ERROR",
    title: "",
    instanceId: "instance-1",
    instanceName: "Pi-hole Casa",
    message: "A conexão foi recusada por https://192.168.31.16.",
    metadata: null,
    state: "ACTIVE",
    isRead: false,
    readAt: null,
    hiddenAt: null,
    resolvedAt: null,
    occurredAt: "2026-04-09T10:00:00.000Z",
    lastSeenAt: "2026-04-09T10:00:00.000Z",
    occurrenceCount: 1,
    canDeleteRemotely: false,
    ...overrides,
  };
}

test("usa rótulo traduzido quando o título veio como tipo técnico", () => {
  const item = makeNotification({
    type: "INSTANCE_SESSION_ERROR",
    title: "INSTANCE_SESSION_ERROR",
  });

  assert.equal(getNotificationTitle(item, ptBRMessages), "Falha de sessão");
});

test("usa motivo explícito quando notificação antiga traz código técnico no título", () => {
  const item = makeNotification({
    type: "NOTIFICATION_SYNC_ERROR",
    title: "ECONNREFUSED",
    metadata: {
      kind: "connection_refused",
    },
  });

  assert.equal(getNotificationTitle(item, ptBRMessages), "Conexão recusada");
});

test("reconhece variação ECONREFUSED sem perder o motivo para o usuário", () => {
  const item = makeNotification({
    type: "NOTIFICATION_SYNC_ERROR",
    title: "ECONREFUSED",
  });

  assert.equal(getNotificationTitle(item, ptBRMessages), "Conexão recusada");
});

test("preserva título explícito não técnico", () => {
  const item = makeNotification({
    type: "SYSTEM_FAILURE",
    title: "Falha ao sincronizar listas",
  });

  assert.equal(getNotificationTitle(item, ptBRMessages), "Falha ao sincronizar listas");
});
