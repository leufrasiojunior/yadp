"use client";

import { cn } from "@/lib/utils";

type StatusToggleProps = {
  activeLabel: string;
  checked: boolean;
  disabled?: boolean;
  inactiveLabel: string;
  onCheckedChange: (checked: boolean) => void;
};

export function StatusToggle({
  activeLabel,
  checked,
  disabled = false,
  inactiveLabel,
  onCheckedChange,
}: Readonly<StatusToggleProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 min-w-[5rem] items-center justify-center whitespace-nowrap px-3 font-semibold text-[10px] text-white uppercase tracking-[0.08em] transition-all duration-200 ease-out",
        checked ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500",
        disabled && "cursor-not-allowed opacity-50 hover:bg-current",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1 bottom-1 w-1.5 bg-white/95 shadow-sm transition-all duration-200 ease-out",
          checked ? "right-1" : "left-1",
        )}
      />
      <span className="relative z-10">{checked ? activeLabel : inactiveLabel}</span>
    </button>
  );
}
