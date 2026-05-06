import type { AppLocaleOption } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { LocaleFlag } from "./locale-flag";

export function LocaleOptionContent({
  option,
  className,
}: Readonly<{
  option: AppLocaleOption;
  className?: string;
}>) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <LocaleFlag countryCode={option.countryCode} />
      <span className="truncate">{option.label}</span>
    </span>
  );
}
