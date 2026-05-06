import Image from "next/image";

import { getLocaleFlagSrc } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleFlag({
  countryCode,
  className,
}: Readonly<{
  countryCode: string;
  className?: string;
}>) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn(
        "h-4 w-auto shrink-0 rounded-[3px] border border-black/10 object-cover shadow-xs dark:border-white/10",
        className,
      )}
      src={getLocaleFlagSrc(countryCode)}
      width={20}
      height={15}
    />
  );
}
