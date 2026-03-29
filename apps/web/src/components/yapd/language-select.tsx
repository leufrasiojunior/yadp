"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Globe } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWebI18n } from "@/lib/i18n/client";
import { type AppLocale, LOCALE_OPTIONS } from "@/lib/i18n/config";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export function LanguageSelect({
  className,
  showIcon = true,
  triggerClassName,
}: Readonly<{
  className?: string;
  showIcon?: boolean;
  triggerClassName?: string;
}>) {
  const router = useRouter();
  const language = usePreferencesStore((state) => state.language);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const { messages } = useWebI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = async (nextLanguage: AppLocale) => {
    setLanguage(nextLanguage);
    await persistPreference("language", nextLanguage);
    router.refresh();
  };

  const currentOption = LOCALE_OPTIONS.find((option) => option.value === language) ??
    LOCALE_OPTIONS.find((option) => option.value === "pt-BR") ?? {
      value: "pt-BR",
      label: "Português (Brasil)",
      shortLabel: "PT-BR",
    };

  if (!mounted) {
    return (
      <div className={className}>
        <div
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm shadow-xs",
            triggerClassName,
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {showIcon ? <Globe className="size-4" /> : null}
            <span className="truncate">{currentOption.label}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select value={language} onValueChange={(value) => void handleChange(value as AppLocale)}>
        <SelectTrigger className={triggerClassName}>
          {showIcon ? <Globe className="size-4" /> : null}
          <SelectValue placeholder={messages.common.languagePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {LOCALE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
