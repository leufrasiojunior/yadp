import type { ReactNode } from "react";

import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { fontVars } from "@/lib/fonts/registry";
import { getServerLocale, getServerTimeZone } from "@/lib/i18n/server";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { ThemeBootScript } from "@/scripts/theme-boot";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, timeZone] = await Promise.all([getServerLocale(), getServerTimeZone()]);
  const {
    language,
    time_zone,
    theme_mode,
    theme_preset,
    content_layout,
    navbar_style,
    sidebar_variant,
    sidebar_collapsible,
    font,
  } = {
    ...PREFERENCE_DEFAULTS,
    language: locale,
    time_zone: timeZone,
  };

  return (
    <html
      className={theme_mode === "dark" ? "dark" : undefined}
      lang={language}
      data-language={language}
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      data-timezone={time_zone}
      style={{ colorScheme: theme_mode === "dark" ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <head />
      <body className={`${fontVars} min-h-screen antialiased`} suppressHydrationWarning>
        {/* Applies theme and layout preferences before hydration without rendering a <script> in the client tree. */}
        <ThemeBootScript />
        <TooltipProvider>
          <PreferencesStoreProvider
            language={language}
            timeZone={time_zone}
            themeMode={theme_mode}
            themePreset={theme_preset}
            contentLayout={content_layout}
            navbarStyle={navbar_style}
            font={font}
          >
            {children}
            <Toaster />
          </PreferencesStoreProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
