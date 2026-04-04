"use client";

import { useId, useState } from "react";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TIME_ZONE_OPTIONS } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function TimeZoneInput({
  className,
  disabled = false,
  emptyText,
  error,
  onChange,
  placeholder,
  searchPlaceholder,
  triggerClassName,
  value,
}: Readonly<{
  className?: string;
  disabled?: boolean;
  emptyText: string;
  error?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  value: string;
}>) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : undefined;
  const label = value || placeholder;

  return (
    <div className={cn("space-y-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", triggerClassName)}
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder ?? placeholder} />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {TIME_ZONE_OPTIONS.map((timeZone) => (
                  <CommandItem
                    key={timeZone}
                    value={timeZone}
                    className="text-xs"
                    onSelect={(selectedTimeZone) => {
                      const nextTimeZone =
                        TIME_ZONE_OPTIONS.find((option) => option.toLowerCase() === selectedTimeZone.toLowerCase()) ??
                        selectedTimeZone;
                      onChange(nextTimeZone);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{timeZone}</span>
                    <Check className={cn("ml-auto size-4", value === timeZone ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
