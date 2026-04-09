import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getWebMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { ApiBackendWait } from "./api-backend-wait";

export function ApiUnavailableScreen({
  className,
  description,
  fullscreen = true,
  locale = DEFAULT_LOCALE,
  retryHref = "/",
  title,
}: Readonly<{
  className?: string;
  description?: string;
  fullscreen?: boolean;
  locale?: AppLocale;
  retryHref?: string;
  title?: string;
}>) {
  const messages = getWebMessages(locale);
  const resolvedTitle = title ?? messages.apiUnavailable.title;
  const resolvedDescription = description ?? messages.apiUnavailable.description;

  const content = (
    <ApiBackendWait locale={locale} retryHref={retryHref} title={resolvedTitle} description={resolvedDescription} />
  );

  if (!fullscreen) {
    return <div className={cn("flex min-h-[60vh] items-center justify-center px-4 py-10", className)}>{content}</div>;
  }

  return (
    <main
      className={cn("mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12", className)}
    >
      {content}
    </main>
  );
}
