"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronRight, ShieldBan } from "lucide-react";
import { toast } from "sonner";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  SyncBlockingApplyResponse,
  SyncBlockingPresetItem,
  SyncBlockingStatusResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import {
  formatSyncBlockingCountdown,
  SYNC_BLOCKING_COUNTDOWN_TICK_INTERVAL_MS,
  SYNC_BLOCKING_STATUS_SYNC_INTERVAL_MS,
} from "@/lib/sync/sync-blocking-time";

import { getSyncBlockingAggregateBadgeVariant, getSyncBlockingAggregateLabel } from "./sidebar-sync-blocking.helpers";
import { SidebarSyncBlockingPresetsDialog } from "./sidebar-sync-blocking-presets-dialog";
import { SidebarSyncBlockingTimeDialog } from "./sidebar-sync-blocking-time-dialog";

type BlockingOperationPayload = {
  blocking: boolean;
  timerSeconds: number | null;
};

type UpdateBlockingPresetsResponse = {
  presets: SyncBlockingPresetItem[];
};

export function SidebarSyncBlocking() {
  const client = useMemo(() => getBrowserApiClient(), []);
  const { baseline, csrfToken } = useAppSession();
  const { locale, messages } = useWebI18n();
  const syncMessages = messages.sidebar.sync;
  const mismatchToastSignatureRef = useRef("");
  const statusRefreshInFlightRef = useRef(false);
  const refreshStatusRef = useRef<
    ((options?: { initialLoad?: boolean; toastOnError?: boolean }) => Promise<SyncBlockingStatusResponse | null>) | null
  >(null);
  const [status, setStatus] = useState<SyncBlockingStatusResponse | null>(null);
  const [statusSyncedAtMs, setStatusSyncedAtMs] = useState<number | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isSavingPresets, setIsSavingPresets] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [isPresetsDialogOpen, setIsPresetsDialogOpen] = useState(false);

  const aggregateBaseLabel = status ? getSyncBlockingAggregateLabel(syncMessages, status.aggregate.status) : "…";
  const aggregateVariant = status ? getSyncBlockingAggregateBadgeVariant(status.aggregate.status) : "outline";
  const busy = isLoadingStatus || isRefreshingStatus || isSavingPresets || isApplying;
  const allInstanceIds = status?.instances.map((instance) => instance.instanceId) ?? [];
  const isGloballyDisabled = status?.aggregate.status === "disabled";
  const blockingPresets = status?.presets ?? [];
  const aggregateCountdownLabel =
    status?.aggregate.status === "disabled" &&
    typeof status.aggregate.timerSeconds === "number" &&
    statusSyncedAtMs !== null
      ? formatSyncBlockingCountdown(
          Math.max(0, status.aggregate.timerSeconds - Math.floor((countdownNowMs - statusSyncedAtMs) / 1000)),
        )
      : null;

  async function refreshStatus(options?: { initialLoad?: boolean; toastOnError?: boolean }) {
    if (statusRefreshInFlightRef.current) {
      return null;
    }

    const isInitialLoad = options?.initialLoad ?? status === null;
    statusRefreshInFlightRef.current = true;

    try {
      if (isInitialLoad) {
        setIsLoadingStatus(true);
      } else {
        setIsRefreshingStatus(true);
      }

      const { data, response } = await client.GET<SyncBlockingStatusResponse>("/sync/operations/blocking");

      if (!response.ok || !data) {
        const message = await getApiErrorMessage(response);
        setStatusError(message);

        if (options?.toastOnError) {
          toast.error(message);
        }

        return null;
      }

      setStatus(data);
      const syncedAt = Date.now();
      setStatusSyncedAtMs(syncedAt);
      setCountdownNowMs(syncedAt);
      setStatusError(null);
      return data;
    } finally {
      setIsLoadingStatus(false);
      setIsRefreshingStatus(false);
      statusRefreshInFlightRef.current = false;
    }
  }

  refreshStatusRef.current = refreshStatus;

  useEffect(() => {
    let active = true;

    async function loadInitialStatus() {
      setIsLoadingStatus(true);
      const { data, response } = await client.GET<SyncBlockingStatusResponse>("/sync/operations/blocking");

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setStatusError(await getApiErrorMessage(response));
        setIsLoadingStatus(false);
        return;
      }

      const syncedAt = Date.now();
      setStatus(data);
      setStatusSyncedAtMs(syncedAt);
      setCountdownNowMs(syncedAt);
      setStatusError(null);
      setIsLoadingStatus(false);
    }

    void loadInitialStatus();

    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshStatusRef.current?.();
    }, SYNC_BLOCKING_STATUS_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (status?.aggregate.status !== "disabled" || status.aggregate.timerSeconds === null) {
      return;
    }

    const intervalId = setInterval(() => {
      setCountdownNowMs(Date.now());
    }, SYNC_BLOCKING_COUNTDOWN_TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [status?.aggregate.status, status?.aggregate.timerSeconds]);

  useEffect(() => {
    if (!status) {
      mismatchToastSignatureRef.current = "";
      return;
    }

    const masterInstance = status.instances.find((instance) => instance.instanceId === baseline.id);

    if (!masterInstance || !masterInstance.reachable || masterInstance.blocking === null) {
      mismatchToastSignatureRef.current = "";
      return;
    }

    const mismatchedInstances = status.instances.filter((instance) => {
      if (instance.instanceId === masterInstance.instanceId) {
        return false;
      }

      if (!instance.reachable || instance.blocking === null) {
        return false;
      }

      return instance.blocking !== masterInstance.blocking || instance.timerSeconds !== masterInstance.timerSeconds;
    });

    if (mismatchedInstances.length === 0) {
      mismatchToastSignatureRef.current = "";
      return;
    }

    const signature = [
      `${masterInstance.instanceId}:${masterInstance.blocking}:${masterInstance.timerSeconds ?? "null"}`,
      ...mismatchedInstances
        .map(
          (instance) =>
            `${instance.instanceId}:${instance.blocking}:${instance.timerSeconds ?? "null"}:${instance.instanceAddress}`,
        )
        .sort(),
    ].join("|");

    if (mismatchToastSignatureRef.current === signature) {
      return;
    }

    mismatchToastSignatureRef.current = signature;

    for (const instance of mismatchedInstances) {
      toast.warning(syncMessages.toasts.masterMismatch(instance.instanceName, instance.instanceAddress));
    }
  }, [baseline.id, status, syncMessages.toasts]);

  async function applyOperation(payload: BlockingOperationPayload) {
    if (allInstanceIds.length === 0) {
      toast.error(statusError ?? syncMessages.toasts.applyFailure);
      return;
    }

    setIsApplying(true);

    const { data, response } = await client.POST<SyncBlockingApplyResponse>("/sync/operations/blocking/apply", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        blocking: payload.blocking,
        timerSeconds: payload.timerSeconds,
        targetInstanceIds: allInstanceIds,
      },
    });

    setIsApplying(false);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    const failedInstances = data.instances.filter(
      (instance) => (instance.status === "FAILURE" || instance.status === "SKIPPED") && instance.message,
    );

    for (const instance of failedInstances) {
      toast.error(syncMessages.toasts.instanceFailure(instance.instanceName, instance.message ?? ""));
    }

    if (data.summary.failedCount === 0 && data.summary.skippedCount === 0) {
      if (data.summary.successfulCount > 0) {
        toast.success(syncMessages.toasts.applySuccess(data.summary.successfulCount));
      } else {
        toast.success(syncMessages.toasts.alreadyDesired);
      }
    } else if (data.summary.successfulCount > 0 || data.summary.noopCount > 0) {
      toast.warning(
        syncMessages.toasts.applyPartial(
          data.summary.successfulCount,
          data.summary.failedCount + data.summary.skippedCount,
        ),
      );
    } else {
      toast.error(syncMessages.toasts.applyFailure);
    }

    await refreshStatus();
  }

  async function savePresets(presets: Array<{ name: string; timerSeconds: number }>) {
    setIsSavingPresets(true);

    const { data, response } = await client.PUT<UpdateBlockingPresetsResponse>("/sync/operations/blocking/presets", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        presets,
      },
    });

    setIsSavingPresets(false);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setIsPresetsDialogOpen(false);
    toast.success(syncMessages.toasts.presetSaved);
    await refreshStatus();
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{messages.sidebar.groups.sync}</SidebarGroupLabel>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            {isGloballyDisabled ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={syncMessages.enableBlocking}
                  variant="outline"
                  className="min-h-10 border-sidebar-border/80 bg-sidebar-accent/15"
                  disabled={busy}
                  onClick={() => void applyOperation({ blocking: true, timerSeconds: null })}
                >
                  <ShieldBan />
                  <span className="truncate">{syncMessages.enableBlocking}</span>
                  {aggregateCountdownLabel ? (
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                      {aggregateCountdownLabel}
                    </span>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <Collapsible asChild defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={syncMessages.blocking}
                      variant="outline"
                      className="min-h-10 border-sidebar-border/80 bg-sidebar-accent/15"
                    >
                      <ShieldBan />
                      <span>{syncMessages.blocking}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <SidebarMenuBadge>
                    <span className="sr-only">{syncMessages.statusTitle}</span>
                    <span
                      className={
                        aggregateVariant === "destructive"
                          ? "rounded bg-destructive/15 px-1.5 py-0.5 text-destructive"
                          : aggregateVariant === "secondary"
                            ? "rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
                            : aggregateVariant === "default"
                              ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                              : "rounded border border-sidebar-border bg-background px-1.5 py-0.5 text-sidebar-foreground"
                      }
                    >
                      {aggregateBaseLabel}
                    </span>
                  </SidebarMenuBadge>
                  <CollapsibleContent>
                    {statusError ? <p className="px-5 pt-3 text-destructive text-xs">{statusError}</p> : null}

                    <div className="px-5 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {syncMessages.disableBlocking}
                    </div>

                    {blockingPresets.length === 0 ? (
                      <p className="px-5 pb-1 text-muted-foreground text-xs">{syncMessages.missingPreset}</p>
                    ) : null}

                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void applyOperation({ blocking: false, timerSeconds: null })}
                          >
                            <span>{syncMessages.quickIndefinite}</span>
                          </button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {blockingPresets.map((preset) => (
                        <SidebarMenuSubItem key={preset.id}>
                          <SidebarMenuSubButton asChild>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void applyOperation({ blocking: false, timerSeconds: preset.timerSeconds })
                              }
                            >
                              <span>{preset.name}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}

                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={false}>
                          <button type="button" disabled={busy} onClick={() => setIsPresetsDialogOpen(true)}>
                            <span>{syncMessages.configurePreset}</span>
                          </button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={false}>
                          <button type="button" disabled={busy} onClick={() => setIsCustomDialogOpen(true)}>
                            <span>{syncMessages.custom}</span>
                          </button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSyncBlockingTimeDialog
        initialTimerSeconds={null}
        isSubmitting={isApplying}
        locale={locale}
        messages={syncMessages}
        mode="custom"
        onOpenChange={setIsCustomDialogOpen}
        onSubmit={(timerSeconds) => {
          setIsCustomDialogOpen(false);
          void applyOperation({ blocking: false, timerSeconds });
        }}
        open={isCustomDialogOpen}
      />

      <SidebarSyncBlockingPresetsDialog
        initialPresets={blockingPresets}
        isSubmitting={isSavingPresets}
        locale={locale}
        messages={syncMessages}
        onOpenChange={setIsPresetsDialogOpen}
        onSubmit={(presets) => {
          void savePresets(presets);
        }}
        open={isPresetsDialogOpen}
      />
    </>
  );
}
