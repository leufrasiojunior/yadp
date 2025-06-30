import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ToggleThemeButton } from '@/components/theme/toggle-theme-button';
import '../global.css';

const supportedLocales = ['en', 'pt'];
const defaultLocale = 'en';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}) {
  // Aguarda os parâmetros antes de usar
  const resolvedParams = await params;

  const locale = supportedLocales.includes(resolvedParams?.locale || '')
    ? resolvedParams!.locale!
    : defaultLocale;

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.classList.add(theme);
                document.documentElement.style.colorScheme = theme;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <div className="absolute top-4 right-4 z-50">
              <ToggleThemeButton />
            </div>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}