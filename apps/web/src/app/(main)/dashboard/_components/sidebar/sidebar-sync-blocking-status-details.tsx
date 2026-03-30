"use client";

import { RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SyncBlockingStatusResponse } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";
import { formatSyncBlockingTimer } from "@/lib/sync/sync-blocking-time";

import {
  getSyncBlockingAggregateBadgeVariant,
  getSyncBlockingAggregateLabel,
  getSyncBlockingInstanceBadgeVariant,
  getSyncBlockingInstanceLabel,
} from "./sidebar-sync-blocking.helpers";

type SidebarSyncBlockingStatusDetailsProps = {
  error: string | null;
  isEnablePending: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  locale: string;
  messages: WebMessages["sidebar"]["sync"];
  onEnable: () => void;
  onRefresh: () => void;
  status: SyncBlockingStatusResponse | null;
};

export function SidebarSyncBlockingStatusDetails({
  error,
  isEnablePending,
  isLoading,
  isRefreshing,
  locale,
  messages,
  onEnable,
  onRefresh,
  status,
}: SidebarSyncBlockingStatusDetailsProps) {
  const aggregateLabel = status ? getSyncBlockingAggregateLabel(messages, status.aggregate.status) : null;
  const aggregateTimerLabel =
    status?.aggregate.status === "disabled"
      ? formatSyncBlockingTimer(status.aggregate.timerSeconds, locale, messages.quickIndefinite)
      : null;
  const hasDisabledInstances =
    status?.instances.some((instance) => instance.reachable && instance.blocking === "disabled") ?? false;

  return (
    <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{messages.statusTitle}</p>
          {status && aggregateLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getSyncBlockingAggregateBadgeVariant(status.aggregate.status)}>{aggregateLabel}</Badge>
              {aggregateTimerLabel ? (
                <span className="text-muted-foreground text-xs">{aggregateTimerLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={messages.refresh}
          disabled={isLoading || isRefreshing || isEnablePending}
          onClick={onRefresh}
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
        </Button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive text-xs">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{messages.statusRefreshError}</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!status && !error ? <p className="mt-3 text-muted-foreground text-xs">{messages.loading}</p> : null}

      {hasDisabledInstances ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 w-full justify-start"
          disabled={isLoading || isRefreshing || isEnablePending}
          onClick={onEnable}
        >
          <ShieldCheck />
          {isEnablePending ? messages.applying : messages.enableBlocking}
        </Button>
      ) : null}

      {status ? (
        <div className="mt-3 space-y-2">
          {status.instances.map((instance) => {
            const timerLabel =
              instance.reachable && instance.blocking === "disabled"
                ? formatSyncBlockingTimer(instance.timerSeconds, locale, messages.quickIndefinite)
                : null;

            return (
              <div
                key={instance.instanceId}
                className="rounded-lg border border-sidebar-border/70 bg-background/70 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-sm">{instance.instanceName}</p>
                  <Badge variant={getSyncBlockingInstanceBadgeVariant(instance)}>
                    {getSyncBlockingInstanceLabel(messages, instance)}
                  </Badge>
                </div>
                {timerLabel ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {messages.timerLabel}: {timerLabel}
                  </p>
                ) : null}
                {!instance.reachable && instance.message ? (
                  <p className="mt-1 text-destructive text-xs">
                    {messages.messageLabel}: {instance.message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
