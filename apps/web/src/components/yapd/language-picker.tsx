"use client";

import { ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AppLocale, getLocaleOption, LOCALE_OPTIONS } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { LocaleOptionContent } from "./locale-option-content";

export function LanguagePicker({
  value,
  onValueChange,
  className,
  showIcon = true,
  size = "default",
  triggerClassName,
}: Readonly<{
  value: AppLocale;
  onValueChange: (value: AppLocale) => void;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "default";
  triggerClassName?: string;
}>) {
  const currentOption = getLocaleOption(value);

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size === "sm" ? "sm" : "default"}
            className={cn("w-full justify-between font-normal", triggerClassName)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {showIcon ? <Globe className="size-4 shrink-0" /> : null}
              <LocaleOptionContent option={currentOption} className="min-w-0 flex-1" />
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuRadioGroup value={value} onValueChange={(nextValue) => onValueChange(nextValue as AppLocale)}>
            {LOCALE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} className={cn(size === "sm" && "text-xs")}>
                <LocaleOptionContent option={option} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
