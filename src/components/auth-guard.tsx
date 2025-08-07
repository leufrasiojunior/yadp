"use client";

import { useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useLocale } from "next-intl";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    const yapdAuthTime = localStorage.getItem("yapdAuthTime");
    if (yapdAuthTime) {
      const authTime = parseInt(yapdAuthTime, 10);
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursInSeconds = 24 * 60 * 60;

      if (now - authTime > twentyFourHoursInSeconds) {
        localStorage.removeItem("yapdAuthTime");
        localStorage.removeItem("piholesAuth");
        router.push(`/${locale}/login`);
      }
    } else {
      router.push(`/${locale}/login`);
    }
  }, [router, pathname, locale]);

  return <>{children}</>;
}
