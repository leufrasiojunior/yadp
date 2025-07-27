import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("locale")?.value;

  if (savedLocale && savedLocale !== locale && routing.locales.includes(savedLocale)) {
    redirect(`/${savedLocale}/dashboard/default`);
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_HOST}/api/config`, { cache: "no-store" });
  const json = await res.json();

  if (json.hasPiholesConfig == false) {
    redirect(`/${locale}/setup`);
  }

  redirect(`/${locale}/login`);
}
