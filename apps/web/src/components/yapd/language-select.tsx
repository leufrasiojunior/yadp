"use client";

import { useRouter } from "next/navigation";

import type { AppLocale } from "@/lib/i18n/config";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { LanguagePicker } from "./language-picker";

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

  const handleChange = async (nextLanguage: AppLocale) => {
    setLanguage(nextLanguage);
    await persistPreference("language", nextLanguage);
    router.refresh();
  };

  return (
    <LanguagePicker
      value={language}
      onValueChange={(value) => void handleChange(value)}
      className={className}
      showIcon={showIcon}
      triggerClassName={triggerClassName}
    />
  );
}
