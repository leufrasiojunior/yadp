"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SyncBlockingPreviewResponse } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";
import { formatSyncBlockingTimer } from "@/lib/sync/sync-blocking-time";

type SidebarSyncBlockingPreviewDialogProps = {
  isSubmitting: boolean;
  locale: string;
  messages: WebMessages["sidebar"]["sync"];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preview: SyncBlockingPreviewResponse | null;
};

function PreviewSection({
  items,
  locale,
  messages,
  tone,
  title,
}: {
  items: Array<{
    instanceId: string;
    instanceName: string;
    blocking?: "enabled" | "disabled";
    timerSeconds?: number | null;
    message?: string;
  }>;
  locale: string;
  messages: WebMessages["sidebar"]["sync"];
  title: string;
  tone: "default" | "destructive";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const timerLabel =
            item.blocking === "disabled"
              ? formatSyncBlockingTimer(item.timerSeconds ?? null, locale, messages.quickIndefinite)
              : null;

          return (
            <div key={item.instanceId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{item.instanceName}</span>
                {item.blocking ? (
                  <Badge variant={item.blocking === "enabled" ? "secondary" : "outline"}>
                    {item.blocking === "enabled" ? messages.instanceEnabled : messages.instanceDisabled}
                  </Badge>
                ) : null}
              </div>
              {timerLabel ? (
                <p className="mt-1 text-muted-foreground text-xs">
                  {messages.timerLabel}: {timerLabel}
                </p>
              ) : null}
              {item.message ? (
                <p
                  className={
                    tone === "destructive" ? "mt-1 text-destructive text-xs" : "mt-1 text-muted-foreground text-xs"
                  }
                >
                  {item.message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SidebarSyncBlockingPreviewDialog({
  isSubmitting,
  locale,
  messages,
  onConfirm,
  onOpenChange,
  open,
  preview,
}: SidebarSyncBlockingPreviewDialogProps) {
  const desiredLabel = !preview
    ? null
    : preview.desiredConfig.blocking
      ? messages.desiredEnable
      : messages.desiredDisable(
          formatSyncBlockingTimer(preview.desiredConfig.timerSeconds, locale, messages.quickIndefinite),
        );
  const canConfirm = (preview?.readyInstances.length ?? 0) > 0;
  const confirmLabel =
    preview && preview.failedInstances.length > 0
      ? messages.applyPartial(preview.readyInstances.length)
      : messages.applyReady(preview?.readyInstances.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{messages.previewTitle}</DialogTitle>
          <DialogDescription>{desiredLabel}</DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{messages.readyInstances(preview.readyInstances.length)}</Badge>
              <Badge variant="outline">{messages.noopInstances(preview.noopInstances.length)}</Badge>
              <Badge variant={preview.failedInstances.length > 0 ? "destructive" : "outline"}>
                {messages.failedInstances(preview.failedInstances.length)}
              </Badge>
            </div>

            {preview.failedInstances.length > 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>{messages.applyPartial(preview.readyInstances.length)}</p>
                </div>
              </div>
            ) : null}

            {!canConfirm ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
                {messages.noReadyInstances}
              </div>
            ) : null}

            <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
              <PreviewSection
                items={preview.readyInstances}
                locale={locale}
                messages={messages}
                tone="default"
                title={messages.readyInstances(preview.readyInstances.length)}
              />
              <PreviewSection
                items={preview.noopInstances}
                locale={locale}
                messages={messages}
                tone="default"
                title={messages.noopInstances(preview.noopInstances.length)}
              />
              <PreviewSection
                items={preview.failedInstances}
                locale={locale}
                messages={messages}
                tone="destructive"
                title={messages.failedInstances(preview.failedInstances.length)}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {messages.close}
          </Button>
          {canConfirm ? (
            <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? messages.applying : confirmLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
