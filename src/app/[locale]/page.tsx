"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useLocale } from "next-intl";

import { AuthGuard } from "@/components/auth-guard";
import { routing } from "@/i18n/routing";

export default function LocalePage() {
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      const res = await fetch("/api/config");
      const json = await res.json();

      if (!json.hasPiholesConfig) {
        router.push(`/${locale}/setup`);
      } else {
        const savedLocale = localStorage.getItem("locale");
        if (savedLocale && savedLocale !== locale && routing.locales.includes(savedLocale)) {
          router.push(`/${savedLocale}/dashboard/default`);
        } else {
          router.push(`/${locale}/dashboard/default`);
        }
      }
      setLoading(false);
    }

    checkConfig();
  }, [router, locale]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthGuard>
      <></>
    </AuthGuard>
  );
}
