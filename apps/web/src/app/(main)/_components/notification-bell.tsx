"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  NotificationReadAllResponse,
  PushPublicKeyResponse,
  PushSubscriptionBody,
  PushSubscriptionResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import {
  getNotificationInstanceLabel,
  getNotificationMessage,
  getNotificationTitle,
} from "@/lib/notifications/notifications";
import { decodePushPublicKey, isCurrentPushSubscriptionServerKey } from "@/lib/notifications/push-subscription";
import { getPushSupportStatus, type PushSupportStatus } from "@/lib/notifications/push-support";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/stores/notifications/notifications-provider";

const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

type PushClient = ReturnType<typeof getAuthenticatedBrowserApiClient>;

type PushActivationFailureKind =
  | "permission-blocked"
  | "permission-denied"
  | "service-worker-unavailable"
  | "vapid-unavailable"
  | "subscribe-failed"
  | "subscription-save-failed"
  | "session-expired"
  | "security-rejected"
  | "unknown";

class PushActivationError extends Error {
  constructor(readonly kind: PushActivationFailureKind) {
    super(kind);
    this.name = "PushActivationError";
  }
}

function getPushStatusToastMessage(status: PushSupportStatus, messages: ReturnType<typeof useWebI18n>["messages"]) {
  if (status === "insecure-context") {
    return messages.notifications.toasts.pushInsecureContext;
  }

  if (status === "server-unavailable") {
    return messages.notifications.toasts.pushServerUnavailable;
  }

  return messages.notifications.toasts.pushUnsupported;
}

function getPushActivationFailureMessage(
  kind: PushActivationFailureKind,
  messages: ReturnType<typeof useWebI18n>["messages"],
) {
  switch (kind) {
    case "permission-blocked":
      return messages.notifications.toasts.pushPermissionBlocked;
    case "permission-denied":
      return messages.notifications.toasts.pushDenied;
    case "service-worker-unavailable":
      return messages.notifications.toasts.pushServiceWorkerUnavailable;
    case "vapid-unavailable":
      return messages.notifications.toasts.pushServerUnavailable;
    case "subscribe-failed":
      return messages.notifications.toasts.pushSubscribeFailed;
    case "subscription-save-failed":
      return messages.notifications.toasts.pushSubscriptionSaveFailed;
    case "session-expired":
      return messages.notifications.toasts.pushSessionExpired;
    case "security-rejected":
      return messages.notifications.toasts.pushSecurityRejected;
    case "unknown":
      return messages.notifications.toasts.pushFailed;
  }
}

function getPushApiFailureKind(response: Response): PushActivationFailureKind | null {
  if (response.status === 401) {
    return "session-expired";
  }

  if (response.status === 403) {
    return "security-rejected";
  }

  return null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, kind: PushActivationFailureKind) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new PushActivationError(kind));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getReadyServiceWorkerRegistration() {
  try {
    return await withTimeout(
      navigator.serviceWorker.ready,
      SERVICE_WORKER_READY_TIMEOUT_MS,
      "service-worker-unavailable",
    );
  } catch (error) {
    if (error instanceof PushActivationError) {
      throw error;
    }

    throw new PushActivationError("service-worker-unavailable");
  }
}

async function getPushPublicKeyOrThrow(client: PushClient) {
  const { data, response } = await client.GET<PushPublicKeyResponse>("/notifications/push/public-key");
  const apiFailureKind = getPushApiFailureKind(response);

  if (apiFailureKind) {
    throw new PushActivationError(apiFailureKind);
  }

  if (!response.ok || !data?.available || !data.publicKey) {
    throw new PushActivationError("vapid-unavailable");
  }

  return data.publicKey;
}

async function requestPushPermissionOrThrow() {
  if (Notification.permission === "denied") {
    throw new PushActivationError("permission-blocked");
  }

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new PushActivationError("permission-denied");
  }

  return permission;
}

async function getCurrentPushSubscriptionOrSubscribe(
  client: PushClient,
  csrfToken: string,
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  const subscription = await registration.pushManager.getSubscription();

  if (subscription && isCurrentPushSubscriptionServerKey(subscription.options.applicationServerKey, publicKey)) {
    return subscription;
  }

  if (subscription) {
    try {
      await client.DELETE<PushSubscriptionResponse>("/notifications/push/subscription", {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        params: {
          query: {
            endpoint: subscription.endpoint,
          },
        },
      });
    } catch {
      // Best-effort cleanup for stale subscriptions.
    }

    await subscription.unsubscribe();
  }

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodePushPublicKey(publicKey),
    });
  } catch {
    throw new PushActivationError("subscribe-failed");
  }
}

export function NotificationBell() {
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const { formatDateTime, messages } = useWebI18n();
  const preview = useNotificationsStore((state) => state.preview);
  const refreshPreview = useNotificationsStore((state) => state.refreshPreview);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [pushAvailable, setPushAvailable] = useState(preview?.push.available ?? false);
  const [pushBusy, setPushBusy] = useState<"enable" | "disable" | null>(null);
  const unreadCount = preview?.unreadCount ?? 0;
  const browserPushSupportStatus = getPushSupportStatus();
  const pushSupportStatus = getPushSupportStatus({ serverAvailable: pushAvailable });

  useEffect(() => {
    if (browserPushSupportStatus !== "supported") {
      return;
    }

    let cancelled = false;

    const loadPushState = async () => {
      try {
        const { data: publicKeyData, response: publicKeyResponse } = await client.GET<PushPublicKeyResponse>(
          "/notifications/push/public-key",
        );
        const publicKey =
          publicKeyResponse.ok && publicKeyData?.available && publicKeyData.publicKey ? publicKeyData.publicKey : null;
        const registration = await getReadyServiceWorkerRegistration();
        let subscription = await registration.pushManager.getSubscription();

        if (
          Notification.permission === "granted" &&
          subscription &&
          publicKey &&
          !isCurrentPushSubscriptionServerKey(subscription.options.applicationServerKey, publicKey)
        ) {
          try {
            await client.DELETE<PushSubscriptionResponse>("/notifications/push/subscription", {
              headers: {
                "x-yapd-csrf": csrfToken,
              },
              params: {
                query: {
                  endpoint: subscription.endpoint,
                },
              },
            });
          } catch {
            // Best-effort cleanup for stale subscriptions.
          }

          await subscription.unsubscribe();
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodePushPublicKey(publicKey),
          });

          const subscriptionJson = subscription.toJSON();
          await client.PUT<PushSubscriptionResponse>("/notifications/push/subscription", {
            headers: {
              "x-yapd-csrf": csrfToken,
            },
            body: {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscriptionJson.keys?.auth ?? "",
                p256dh: subscriptionJson.keys?.p256dh ?? "",
              },
              userAgent: navigator.userAgent,
            },
          });
        }

        if (cancelled) {
          return;
        }

        setPushAvailable(Boolean(publicKey));
        setPushPermission(Notification.permission);
        setPushEndpoint(subscription?.endpoint ?? null);
      } catch {
        if (!cancelled) {
          setPushPermission(Notification.permission);
        }
      }
    };

    void loadPushState();

    return () => {
      cancelled = true;
    };
  }, [browserPushSupportStatus, client, csrfToken]);

  const handleMarkAllAsRead = async () => {
    const { data, response } = await client.PATCH<NotificationReadAllResponse>("/notifications/read-all", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
    });

    if (!response.ok || !data) {
      toast.error(messages.notifications.toasts.refreshFailed);
      return;
    }

    toast.success(messages.notifications.toasts.markAllReadSuccess(data.updatedCount));
    await refreshPreview();
  };

  const handleEnablePush = async () => {
    if (pushSupportStatus !== "supported") {
      toast.error(getPushStatusToastMessage(pushSupportStatus, messages));
      return;
    }

    setPushBusy("enable");

    try {
      const permission = await requestPushPermissionOrThrow();
      setPushPermission(permission);

      const publicKey = await getPushPublicKeyOrThrow(client);
      setPushAvailable(true);

      const registration = await getReadyServiceWorkerRegistration();
      const subscription = await getCurrentPushSubscriptionOrSubscribe(client, csrfToken, registration, publicKey);
      const subscriptionJson = subscription.toJSON();
      const body: PushSubscriptionBody = {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscriptionJson.keys?.auth ?? "",
          p256dh: subscriptionJson.keys?.p256dh ?? "",
        },
        userAgent: navigator.userAgent,
      };
      const { data, response } = await client.PUT<PushSubscriptionResponse>("/notifications/push/subscription", {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        body,
      });
      const apiFailureKind = getPushApiFailureKind(response);

      if (apiFailureKind) {
        throw new PushActivationError(apiFailureKind);
      }

      if (!response.ok || !data) {
        throw new PushActivationError("subscription-save-failed");
      }

      setPushEndpoint(data.endpoint);
      toast.success(messages.notifications.toasts.pushEnabled);
      await refreshPreview();
    } catch (error) {
      const kind = error instanceof PushActivationError ? error.kind : "unknown";
      toast.error(getPushActivationFailureMessage(kind, messages));
    } finally {
      setPushBusy(null);
    }
  };

  const handleDisablePush = async () => {
    if (browserPushSupportStatus !== "supported") {
      toast.error(getPushStatusToastMessage(browserPushSupportStatus, messages));
      return;
    }

    setPushBusy("disable");

    try {
      const registration = await getReadyServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? pushEndpoint;

      if (endpoint) {
        await client.DELETE<PushSubscriptionResponse>("/notifications/push/subscription", {
          headers: {
            "x-yapd-csrf": csrfToken,
          },
          params: {
            query: {
              endpoint,
            },
          },
        });
      }

      await subscription?.unsubscribe();
      setPushEndpoint(null);
      toast.success(messages.notifications.toasts.pushDisabled);
      await refreshPreview();
    } catch {
      toast.error(messages.notifications.toasts.pushFailed);
    } finally {
      setPushBusy(null);
    }
  };

  const pushLabel = (() => {
    if (pushSupportStatus === "insecure-context") {
      return messages.notifications.preview.pushInsecureContext;
    }

    if (pushSupportStatus === "unsupported-browser") {
      return messages.notifications.preview.pushUnsupported;
    }

    if (pushSupportStatus === "server-unavailable") {
      return messages.notifications.preview.pushServerUnavailable;
    }

    if (pushPermission === "denied") {
      return messages.notifications.preview.pushDenied;
    }

    if (pushBusy === "enable") {
      return messages.notifications.preview.pushEnabling;
    }

    if (pushEndpoint) {
      return messages.notifications.preview.pushEnabled;
    }

    return messages.notifications.preview.pushEnable;
  })();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative shrink-0">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="-top-1 -right-1 absolute min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">{messages.sidebar.items.notifications}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] overflow-hidden p-0 sm:w-[24rem]">
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div>
            <DropdownMenuLabel className="p-0">{messages.notifications.preview.title}</DropdownMenuLabel>
            <p className="text-muted-foreground text-xs">{messages.notifications.preview.unreadCount(unreadCount)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleMarkAllAsRead()} disabled={unreadCount === 0}>
            <CheckCheck className="size-4" />
            {messages.notifications.preview.markAllRead}
          </Button>
        </div>
        <DropdownMenuSeparator className="shrink-0" />
        <ScrollArea className="max-h-[min(20rem,max(8rem,calc(var(--radix-dropdown-menu-content-available-height)-10rem)))] overflow-hidden">
          {preview?.items.length ? (
            <div className="flex flex-col">
              {preview.items.map((item) => (
                <DropdownMenuItem key={item.id} asChild className="block cursor-pointer px-4 py-3">
                  <Link prefetch={false} href="/notifications">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-sm", !item.isRead && "font-semibold")}>
                            {getNotificationTitle(item, messages)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {getNotificationInstanceLabel(item, messages)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm">{getNotificationMessage(item, messages, formatDateTime)}</p>
                      </div>
                      <span className="shrink-0 text-muted-foreground text-xs">{formatDateTime(item.occurredAt)}</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">
              {messages.notifications.preview.empty}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="shrink-0" />
        <div className="flex shrink-0 flex-col gap-2 px-4 py-3">
          <Button
            variant={pushEndpoint ? "outline" : "default"}
            size="sm"
            onClick={() => void (pushEndpoint ? handleDisablePush() : handleEnablePush())}
            disabled={pushBusy !== null || (!pushEndpoint && pushSupportStatus !== "supported")}
          >
            {pushEndpoint ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            {pushEndpoint ? messages.notifications.preview.pushDisable : pushLabel}
          </Button>
          <Button asChild variant="ghost" size="sm" className="justify-start">
            <Link prefetch={false} href="/notifications">
              {messages.notifications.preview.seeAll}
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
