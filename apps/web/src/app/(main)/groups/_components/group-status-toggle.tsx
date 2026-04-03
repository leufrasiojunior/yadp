"use client";

import { cn } from "@/lib/utils";

type GroupStatusToggleProps = {
  activeLabel: string;
  checked: boolean;
  disabled?: boolean;
  inactiveLabel: string;
  onCheckedChange: (checked: boolean) => void;
};

export function GroupStatusToggle({
  activeLabel,
  checked,
  disabled = false,
  inactiveLabel,
  onCheckedChange,
}: Readonly<GroupStatusToggleProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-24 items-center justify-center rounded-md px-2 font-semibold text-[10px] text-white tracking-wide transition-all duration-200 ease-out",
        checked ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500",
        disabled && "cursor-not-allowed opacity-50 hover:bg-current",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1.5 left-2 h-5 w-1.5 rounded-sm bg-white/95 shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[3.625rem]" : "translate-x-0",
        )}
      />
      <span className="relative z-10">{checked ? activeLabel : inactiveLabel}</span>
    </button>
  );
}
