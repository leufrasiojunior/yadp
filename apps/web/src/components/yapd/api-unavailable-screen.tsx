import Link from "next/link";

import { PlugZap, ServerCrash } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ApiUnavailableScreen({
  apiBaseUrl,
  className,
  description = "O frontend iniciou, mas nao conseguiu falar com o backend do YAPD.",
  fullscreen = true,
  retryHref = "/",
  title = "Backend indisponivel",
}: Readonly<{
  apiBaseUrl: string;
  className?: string;
  description?: string;
  fullscreen?: boolean;
  retryHref?: string;
  title?: string;
}>) {
  const content = (
    <div className="w-full max-w-3xl space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <ServerCrash className="size-5" />
            <span className="font-medium text-sm uppercase tracking-[0.24em]">YAPD API</span>
          </div>
          <CardTitle className="text-4xl tracking-tight">{title}</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <Alert>
            <PlugZap className="size-4" />
            <AlertTitle>Como liberar o frontend</AlertTitle>
            <AlertDescription>
              Inicie o backend com <code>npm run dev:api</code> e confirme que ele esta respondendo em{" "}
              <code>{apiBaseUrl}</code>.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={retryHref}>Tentar novamente</Link>
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
