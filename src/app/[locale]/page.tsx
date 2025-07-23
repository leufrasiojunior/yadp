import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("locale")?.value;

  // If user has a different saved preference, redirect to that
  if (savedLocale && savedLocale !== locale && routing.locales.includes(savedLocale)) {
    redirect(`/${savedLocale}/dashboard/default`);
  }

  redirect(`/${locale}/dashboard/default`);
}
