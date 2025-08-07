import { ReactNode } from "react";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app-config";
import { routing } from "@/i18n/routing";
import { getPreference } from "@/server/server-actions";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { THEME_MODE_VALUES, THEME_PRESET_VALUES, type ThemePreset, type ThemeMode } from "@/types/preferences/theme";

import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
};

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const themeMode = await getPreference<ThemeMode>("theme_mode", THEME_MODE_VALUES, "light");
  const themePreset = await getPreference<ThemePreset>("theme_preset", THEME_PRESET_VALUES, "default");

  // Get saved locale preference from cookie
  // const savedLocale = await getPreference<string>("locale", ["en", "pt-br"], "pt-br");

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={themeMode === "dark" ? "dark" : ""}
      data-theme-preset={themePreset}
      suppressHydrationWarning
    >
      <body className={`${inter.className} min-h-screen antialiased`} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PreferencesStoreProvider themeMode={themeMode} themePreset={themePreset}>
            {children}
            <Toaster position="top-center" richColors expand={true} closeButton visibleToasts={5} />
          </PreferencesStoreProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
