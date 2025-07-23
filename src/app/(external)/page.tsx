import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

export default async function RootPage() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("locale")?.value;

  // Use saved locale if available and supported, otherwise use default
  const targetLocale = savedLocale && routing.locales.includes(savedLocale) ? savedLocale : routing.defaultLocale;

  redirect(`/${targetLocale}/dashboard/default`);
}
