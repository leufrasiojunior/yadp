"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WebMessages } from "@/lib/i18n/messages";
import {
  formatSyncBlockingTimer,
  type SyncBlockingTimeUnit,
  toSyncBlockingTimerSeconds,
} from "@/lib/sync/sync-blocking-time";

export type SidebarSyncBlockingTimeDialogMode = "custom" | "preset";

type SidebarSyncBlockingTimeDialogProps = {
  initialTimerSeconds: number | null;
  isSubmitting: boolean;
  locale: string;
  messages: WebMessages["sidebar"]["sync"];
  mode: SidebarSyncBlockingTimeDialogMode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (timerSeconds: number) => void;
  open: boolean;
};

function toDialogDefaults(timerSeconds: number | null): { rawValue: string; unit: SyncBlockingTimeUnit } {
  if (typeof timerSeconds === "number" && timerSeconds >= 60 && timerSeconds % 60 === 0) {
    return {
      rawValue: String(timerSeconds / 60),
      unit: "minutes",
    };
  }

  if (typeof timerSeconds === "number" && timerSeconds > 0) {
    return {
      rawValue: String(timerSeconds),
      unit: "seconds",
    };
  }

  return {
    rawValue: "5",
    unit: "minutes",
  };
}

export function SidebarSyncBlockingTimeDialog({
  initialTimerSeconds,
  isSubmitting,
  locale,
  messages,
  mode,
  onOpenChange,
  onSubmit,
  open,
}: SidebarSyncBlockingTimeDialogProps) {
  const defaults = useMemo(() => toDialogDefaults(initialTimerSeconds), [initialTimerSeconds]);
  const [rawValue, setRawValue] = useState(defaults.rawValue);
  const [unit, setUnit] = useState<SyncBlockingTimeUnit>(defaults.unit);

  useEffect(() => {
    if (!open) {
      return;
    }

    setRawValue(defaults.rawValue);
    setUnit(defaults.unit);
  }, [defaults.rawValue, defaults.unit, open]);

  const parsedValue = Number.parseInt(rawValue, 10);
  const isValidValue = Number.isInteger(parsedValue) && parsedValue > 0;
  const timerSeconds = isValidValue ? toSyncBlockingTimerSeconds(parsedValue, unit) : null;
  const normalizedLabel =
    timerSeconds === null ? null : formatSyncBlockingTimer(timerSeconds, locale, messages.quickIndefinite);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "preset" ? messages.configurePreset : messages.custom}</DialogTitle>
          <DialogDescription>
            {mode === "preset" ? messages.presetDescription : messages.customDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="sync-blocking-time-value" className="font-medium text-sm">
              {messages.valueLabel}
            </label>
            <Input
              id="sync-blocking-time-value"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={rawValue}
              onChange={(event) => setRawValue(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <span className="font-medium text-sm">{messages.unitLabel}</span>
            <Select value={unit} onValueChange={(value) => setUnit(value as SyncBlockingTimeUnit)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">{messages.unitSeconds}</SelectItem>
                <SelectItem value="minutes">{messages.unitMinutes}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
            {normalizedLabel ? messages.normalizedTimer(normalizedLabel) : messages.invalidValue}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {messages.cancel}
          </Button>
          <Button
            type="button"
            disabled={!isValidValue || isSubmitting}
            onClick={() => {
              if (timerSeconds === null) {
                return;
              }

              onSubmit(timerSeconds);
            }}
          >
            {isSubmitting
              ? mode === "preset"
                ? messages.savingPreset
                : messages.previewing
              : mode === "preset"
                ? messages.savePreset
                : messages.custom}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
