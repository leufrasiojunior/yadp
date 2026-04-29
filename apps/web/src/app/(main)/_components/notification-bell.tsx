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
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/stores/notifications/notifications-provider";

function isPushSupported() {
  return (
    typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
  );
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

  useEffect(() => {
    if (!isPushSupported()) {
      return;
    }

    let cancelled = false;

    const loadPushState = async () => {
      const { data: publicKeyData, response: publicKeyResponse } = await client.GET<PushPublicKeyResponse>(
        "/notifications/push/public-key",
      );
      const publicKey =
        publicKeyResponse.ok && publicKeyData?.available && publicKeyData.publicKey ? publicKeyData.publicKey : null;
      const registration = await navigator.serviceWorker.ready;
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
    };

    void loadPushState();

    return () => {
      cancelled = true;
    };
  }, [client, csrfToken]);

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
    if (!isPushSupported()) {
      toast.error(messages.notifications.toasts.pushUnsupported);
      return;
    }

    setPushBusy("enable");

    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        toast.error(messages.notifications.toasts.pushDenied);
        return;
      }

      const { data: publicKeyData, response: publicKeyResponse } = await client.GET<PushPublicKeyResponse>(
        "/notifications/push/public-key",
      );

      if (!publicKeyResponse.ok || !publicKeyData?.available || !publicKeyData.publicKey) {
        setPushAvailable(false);
        toast.error(messages.notifications.toasts.pushFailed);
        return;
      }

      setPushAvailable(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodePushPublicKey(publicKeyData.publicKey),
        }));
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

      if (!response.ok || !data) {
        toast.error(messages.notifications.toasts.pushFailed);
        return;
      }

      setPushEndpoint(data.endpoint);
      toast.success(messages.notifications.toasts.pushEnabled);
      await refreshPreview();
    } catch {
      toast.error(messages.notifications.toasts.pushFailed);
    } finally {
      setPushBusy(null);
    }
  };

  const handleDisablePush = async () => {
    if (!isPushSupported()) {
      toast.error(messages.notifications.toasts.pushUnsupported);
      return;
    }

    setPushBusy("disable");

    try {
      const registration = await navigator.serviceWorker.ready;
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
    if (!isPushSupported()) {
      return messages.notifications.preview.pushUnsupported;
    }

    if (!pushAvailable) {
      return messages.notifications.preview.pushUnsupported;
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
        <Button variant="outline" size="icon" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="-top-1 -right-1 absolute min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">{messages.sidebar.items.notifications}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[24rem] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <DropdownMenuLabel className="p-0">{messages.notifications.preview.title}</DropdownMenuLabel>
            <p className="text-muted-foreground text-xs">{messages.notifications.preview.unreadCount(unreadCount)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleMarkAllAsRead()} disabled={unreadCount === 0}>
            <CheckCheck className="size-4" />
            {messages.notifications.preview.markAllRead}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-80">
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
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-2 px-4 py-3">
          <Button
            variant={pushEndpoint ? "outline" : "default"}
            size="sm"
            onClick={() => void (pushEndpoint ? handleDisablePush() : handleEnablePush())}
            disabled={pushBusy !== null || !pushAvailable}
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
