import Link from "next/link";

import { AlertCircle, Bug, ServerCog } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getWebMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export function ApiErrorScreen({
  apiBaseUrl,
  className,
  fullscreen = true,
  locale = DEFAULT_LOCALE,
  message,
  retryHref = "/",
  status,
  title,
}: Readonly<{
  apiBaseUrl: string;
  className?: string;
  fullscreen?: boolean;
  locale?: AppLocale;
  message: string;
  retryHref?: string;
  status?: number;
  title?: string;
}>) {
  const messages = getWebMessages(locale);
  const resolvedTitle = title ?? messages.apiError.title;

  const content = (
    <div className="w-full max-w-3xl space-y-4">
      <Card className="border-amber-500/25 bg-amber-500/5">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <ServerCog className="size-5" />
            <span className="font-medium text-sm uppercase tracking-[0.24em]">{messages.apiError.badge}</span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl tracking-tight">{resolvedTitle}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">{message}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <Alert>
            <Bug className="size-4" />
            <AlertTitle>{messages.apiError.helpTitle}</AlertTitle>
            <AlertDescription>{messages.apiError.helpDescription(apiBaseUrl, status)}</AlertDescription>
          </Alert>
          {status ? (
            <div className="inline-flex·items-center·gap-2·rounded-full·border·px-3·py-1·text-muted-foreground·text-xs">
              <AlertCircle className="size-3.5" />
              HTTP {status}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={retryHref}>{messages.common.retry}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!fullscreen) {
    return <div className={cn("space-y-6", className)}>{content}</div>;
  }

  return (
    <main className={cn("mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12", className)}>
      {content}
    </main>
  );
}
