"use client";

import { useEffect, useMemo, useState } from "react";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

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
import type { SyncBlockingPresetItem } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";
import {
  formatSyncBlockingTimer,
  type SyncBlockingTimeUnit,
  toSyncBlockingTimerSeconds,
} from "@/lib/sync/sync-blocking-time";

type EditableBlockingPreset = {
  clientId: string;
  name: string;
  rawValue: string;
  unit: SyncBlockingTimeUnit;
};

type SidebarSyncBlockingPresetsDialogProps = {
  initialPresets: SyncBlockingPresetItem[];
  isSubmitting: boolean;
  locale: string;
  messages: WebMessages["sidebar"]["sync"];
  onOpenChange: (open: boolean) => void;
  onSubmit: (presets: Array<{ name: string; timerSeconds: number }>) => void;
  open: boolean;
};

function getPresetDefaults(timerSeconds: number): { rawValue: string; unit: SyncBlockingTimeUnit } {
  if (timerSeconds >= 60 && timerSeconds % 60 === 0) {
    return {
      rawValue: String(timerSeconds / 60),
      unit: "minutes",
    };
  }

  return {
    rawValue: String(timerSeconds),
    unit: "seconds",
  };
}

function toEditablePreset(preset: SyncBlockingPresetItem): EditableBlockingPreset {
  const defaults = getPresetDefaults(preset.timerSeconds);

  return {
    clientId: preset.id,
    name: preset.name,
    rawValue: defaults.rawValue,
    unit: defaults.unit,
  };
}

function createEmptyPreset(): EditableBlockingPreset {
  return {
    clientId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: "",
    rawValue: "5",
    unit: "minutes",
  };
}

export function SidebarSyncBlockingPresetsDialog({
  initialPresets,
  isSubmitting,
  locale,
  messages,
  onOpenChange,
  onSubmit,
  open,
}: SidebarSyncBlockingPresetsDialogProps) {
  const [presets, setPresets] = useState<EditableBlockingPreset[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPresets(initialPresets.map(toEditablePreset));
  }, [initialPresets, open]);

  const normalizedPresets = useMemo(() => {
    return presets.map((preset) => {
      const parsedValue = Number.parseInt(preset.rawValue, 10);
      const isValidValue = Number.isInteger(parsedValue) && parsedValue > 0;

      return {
        clientId: preset.clientId,
        name: preset.name.trim(),
        timerSeconds: isValidValue ? toSyncBlockingTimerSeconds(parsedValue, preset.unit) : null,
        valid: preset.name.trim().length > 0 && isValidValue,
      };
    });
  }, [presets]);

  const canSave = normalizedPresets.every((preset) => preset.valid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{messages.presetsManagerTitle}</DialogTitle>
          <DialogDescription>{messages.presetsManagerDescription}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {presets.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
              {messages.emptyPresets}
            </div>
          ) : null}

          {presets.map((preset, index) => {
            const normalized = normalizedPresets[index];
            const normalizedLabel =
              normalized && normalized.timerSeconds !== null
                ? formatSyncBlockingTimer(normalized.timerSeconds, locale, messages.quickIndefinite)
                : null;
            const aliasInputId = `sync-blocking-preset-alias-${preset.clientId}`;
            const valueInputId = `sync-blocking-preset-value-${preset.clientId}`;
            const unitInputId = `sync-blocking-preset-unit-${preset.clientId}`;

            return (
              <div key={preset.clientId} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_140px_140px_auto]">
                  <div className="grid gap-1.5">
                    <label htmlFor={aliasInputId} className="font-medium text-sm">
                      {messages.presetAliasLabel}
                    </label>
                    <Input
                      id={aliasInputId}
                      value={preset.name}
                      onChange={(event) =>
                        setPresets((current) =>
                          current.map((item) =>
                            item.clientId === preset.clientId ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor={valueInputId} className="font-medium text-sm">
                      {messages.valueLabel}
                    </label>
                    <Input
                      id={valueInputId}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={preset.rawValue}
                      onChange={(event) =>
                        setPresets((current) =>
                          current.map((item) =>
                            item.clientId === preset.clientId ? { ...item, rawValue: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor={unitInputId} className="font-medium text-sm">
                      {messages.unitLabel}
                    </label>
                    <Select
                      value={preset.unit}
                      onValueChange={(value) =>
                        setPresets((current) =>
                          current.map((item) =>
                            item.clientId === preset.clientId ? { ...item, unit: value as SyncBlockingTimeUnit } : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger id={unitInputId} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seconds">{messages.unitSeconds}</SelectItem>
                        <SelectItem value="minutes">{messages.unitMinutes}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isSubmitting || index === 0}
                      aria-label={messages.movePresetUp}
                      onClick={() =>
                        setPresets((current) => {
                          if (index === 0) {
                            return current;
                          }

                          const next = [...current];
                          const [item] = next.splice(index, 1);

                          if (!item) {
                            return current;
                          }

                          next.splice(index - 1, 0, item);
                          return next;
                        })
                      }
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isSubmitting || index === presets.length - 1}
                      aria-label={messages.movePresetDown}
                      onClick={() =>
                        setPresets((current) => {
                          if (index >= current.length - 1) {
                            return current;
                          }

                          const next = [...current];
                          const [item] = next.splice(index, 1);

                          if (!item) {
                            return current;
                          }

                          next.splice(index + 1, 0, item);
                          return next;
                        })
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isSubmitting}
                      aria-label={messages.removePreset}
                      onClick={() =>
                        setPresets((current) => current.filter((item) => item.clientId !== preset.clientId))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 text-muted-foreground text-xs">
                  {normalizedLabel ? messages.normalizedTimer(normalizedLabel) : messages.invalidValue}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setPresets((current) => [...current, createEmptyPreset()])}
          >
            <Plus />
            {messages.addPreset}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {messages.cancel}
            </Button>
            <Button
              type="button"
              disabled={!canSave || isSubmitting}
              onClick={() =>
                onSubmit(
                  normalizedPresets
                    .filter((preset) => preset.timerSeconds !== null && preset.name.length > 0)
                    .map((preset) => ({
                      name: preset.name,
                      timerSeconds: preset.timerSeconds as number,
                    })),
                )
              }
            >
              {isSubmitting ? messages.savingPresets : messages.savePresets}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
