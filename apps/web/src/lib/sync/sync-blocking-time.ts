import { FRONTEND_CONFIG } from "@/config/frontend-config";

export type SyncBlockingTimeUnit = "seconds" | "minutes";

export const SYNC_BLOCKING_STATUS_SYNC_INTERVAL_MS = FRONTEND_CONFIG.sync.blocking.statusRefreshIntervalMs;
export const SYNC_BLOCKING_COUNTDOWN_TICK_INTERVAL_MS = FRONTEND_CONFIG.sync.blocking.countdownTickIntervalMs;

export function toSyncBlockingTimerSeconds(value: number, unit: SyncBlockingTimeUnit) {
  return unit === "minutes" ? value * 60 : value;
}

export function formatSyncBlockingTimer(timerSeconds: number | null, locale: string, indefiniteLabel: string) {
  if (timerSeconds === null) {
    return indefiniteLabel;
  }

  if (timerSeconds >= 60 && timerSeconds % 60 === 0) {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "minute",
      unitDisplay: "long",
    }).format(timerSeconds / 60);
  }

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "second",
    unitDisplay: "long",
  }).format(timerSeconds);
}

export function formatSyncBlockingCountdown(timerSeconds: number) {
  const clampedSeconds = Math.max(0, Math.floor(timerSeconds));
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;

  if (clampedSeconds > 3600) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [hours * 60 + minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
