"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getBrowserApiBaseUrl } from "@/lib/api/base-url";
import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getWebMessages } from "@/lib/i18n/messages";

const INITIAL_RETRY_DELAY_SECONDS = 10;
const RETRY_DELAY_STEP_SECONDS = 10;
const RETRY_COUNTDOWN_STEP_SECONDS = 5;
const MAX_RETRY_DELAY_SECONDS = 60;

function normalizeHealthUrl() {
  return `${getBrowserApiBaseUrl().replace(/\/$/, "")}/health`;
}

export function ApiBackendWait({
  locale = DEFAULT_LOCALE,
  retryHref,
  title,
  description,
}: Readonly<{
  locale?: AppLocale;
  retryHref: string;
  title: string;
  description: string;
}>) {
  const messages = getWebMessages(locale);
  const [retryAttempt, setRetryAttempt] = useState(1);
  const [secondsUntilRetry, setSecondsUntilRetry] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const healthUrl = normalizeHealthUrl();
    let isActive = true;
    let retryTimeoutId: number | null = null;
    let countdownIntervalId: number | null = null;

    const clearTimers = () => {
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }

      if (countdownIntervalId !== null) {
        window.clearInterval(countdownIntervalId);
      }
    };

    const redirectToRetryHref = () => {
      window.location.assign(retryHref);
    };

    const checkBackendHealth = async () => {
      if (!isActive) {
        return false;
      }

      setIsChecking(true);

      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            accept: "application/json",
          },
        });

        if (response.ok) {
          redirectToRetryHref();
          return true;
        }
      } catch {
        // The waiting screen treats any fetch failure as backend still booting.
      }

      if (!isActive) {
        return true;
      }

      setIsChecking(false);
      return false;
    };

    const scheduleRetry = (delaySeconds: number, attemptNumber: number) => {
      if (!isActive) {
        return;
      }

      clearTimers();
      setRetryAttempt(attemptNumber);
      setSecondsUntilRetry(delaySeconds);

      countdownIntervalId = window.setInterval(() => {
        if (!isActive) {
          return;
        }

        setSecondsUntilRetry((currentSeconds) => {
          if (currentSeconds === null) {
            return currentSeconds;
          }

          return currentSeconds > RETRY_COUNTDOWN_STEP_SECONDS
            ? currentSeconds - RETRY_COUNTDOWN_STEP_SECONDS
            : currentSeconds;
        });
      }, RETRY_COUNTDOWN_STEP_SECONDS * 1000);

      retryTimeoutId = window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        if (countdownIntervalId !== null) {
          window.clearInterval(countdownIntervalId);
          countdownIntervalId = null;
        }

        setSecondsUntilRetry(null);

        void checkBackendHealth().then((isHealthy) => {
          if (!isActive || isHealthy) {
            return;
          }

          scheduleRetry(Math.min(delaySeconds + RETRY_DELAY_STEP_SECONDS, MAX_RETRY_DELAY_SECONDS), attemptNumber + 1);
        });
      }, delaySeconds * 1000);
    };

    void checkBackendHealth().then((isHealthy) => {
      if (!isActive || isHealthy) {
        return;
      }

      scheduleRetry(INITIAL_RETRY_DELAY_SECONDS, 1);
    });

    return () => {
      isActive = false;
      clearTimers();
    };
  }, [retryHref]);

  return (
    <div className="w-full max-w-2xl space-y-8 text-center">
      <div className="mx-auto grid size-28 place-items-center rounded-full border border-primary/15 bg-primary/5 text-primary shadow-sm">
        <Spinner className="size-14" />
      </div>

      <div className="space-y-3">
        <p className="font-medium text-primary text-xs uppercase tracking-[0.24em]">{messages.apiUnavailable.badge}</p>
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground leading-7">{description}</p>
      </div>

      <div
        className="space-y-3 rounded-2xl border border-border/70 bg-background/80 px-6 py-5 shadow-sm"
        aria-live="polite"
      >
        <p className="font-medium text-sm">
          {isChecking || secondsUntilRetry === null
            ? messages.apiUnavailable.checking
            : messages.apiUnavailable.nextAttemptIn(secondsUntilRetry)}
        </p>
        <p className="text-muted-foreground text-sm">{messages.apiUnavailable.attempt(retryAttempt)}</p>
        <div className="flex justify-center">
          <Button asChild variant="link" className="h-auto px-0">
            <a href={retryHref}>{messages.apiUnavailable.reloadNow}</a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs leading-6">{messages.apiUnavailable.helpDescription}</p>
      </div>
    </div>
  );
}
