"use client";

import { useParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const LOCALE_OPTIONS = [
  {
    value: "en",
    label: "English",
    flag: "🇺🇸"
  },
  {
    value: "pt-br", 
    label: "Português",
    flag: "🇧🇷"
  }
];

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleLocaleChange = (locale: string) => {
    router.replace(pathname, { locale });
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">Language</Label>
      <Select value={currentLocale} onValueChange={handleLocaleChange}>
        <SelectTrigger size="sm" className="w-full text-xs" suppressHydrationWarning>
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {LOCALE_OPTIONS.map((locale) => (
            <SelectItem key={locale.value} className="text-xs" value={locale.value}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{locale.flag}</span>
                <span>{locale.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
