import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToggleThemeButton } from "@/components/theme/toggle-theme-button";
import { SideMenu } from "@/components/general/side-menu";
import "../global.css";
import { notFound } from "next/navigation";
import { routing } from '@/i18n/routing';
import { PiholeAuthProvider } from "@/context/PiholeAuthContext";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <PiholeAuthProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>

            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <div className="absolute top-4 left-4 z-50">
                <SideMenu />
              </div>
              <div className="absolute top-4 right-4 z-50">
                <ToggleThemeButton />
              </div>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
        </PiholeAuthProvider>
      </body>
    </html>
  );
}
