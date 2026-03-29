import Link from "next/link";

import { PlugZap, ServerCrash } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getWebMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export function ApiUnavailableScreen({
  apiBaseUrl,
  className,
  description,
  fullscreen = true,
  locale = DEFAULT_LOCALE,
  retryHref = "/",
  title,
}: Readonly<{
  apiBaseUrl: string;
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
    <div className="w-full max-w-3xl space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <ServerCrash className="size-5" />
            <span className="font-medium text-sm uppercase tracking-[0.24em]">{messages.apiUnavailable.badge}</span>
          </div>
          <CardTitle className="text-4xl tracking-tight">{resolvedTitle}</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7">{resolvedDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <Alert>
            <PlugZap className="size-4" />
            <AlertTitle>{messages.apiUnavailable.helpTitle}</AlertTitle>
            <AlertDescription>{messages.apiUnavailable.helpDescription(apiBaseUrl)}</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={retryHref}>{messages.apiUnavailable.retry}</Link>
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
