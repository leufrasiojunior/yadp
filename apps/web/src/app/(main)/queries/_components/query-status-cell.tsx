"use client";

import type { LucideIcon } from "lucide-react";
import { Ban, Clock3, Database, Globe, Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WebMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type StatusVisual = {
  Icon: LucideIcon;
  iconClassName: string;
  tooltip: string;
};

function normalizeStatus(status: string | null) {
  return status?.trim().toUpperCase() ?? "";
}

function getStatusVisual(status: string | null, messages: WebMessages): StatusVisual | null {
  const normalizedStatus = normalizeStatus(status);

  switch (normalizedStatus) {
    case "CACHE":
      return {
        Icon: Database,
        iconClassName: "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300",
        tooltip: messages.queries.statusTypes.cache,
      };
    case "FORWARDED":
      return {
        Icon: Globe,
        iconClassName: "bg-emerald-500/16 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200",
        tooltip: messages.queries.statusTypes.forwarded,
      };
    case "CACHE_STALE":
      return {
        Icon: Clock3,
        iconClassName: "bg-emerald-500/20 text-emerald-900 ring-1 ring-emerald-500/30 dark:text-emerald-100",
        tooltip: messages.queries.statusTypes.cacheStale,
      };
    case "GRAVITY":
      return {
        Icon: Ban,
        iconClassName: "bg-red-500/14 text-red-700 ring-1 ring-red-500/20 dark:text-red-200",
        tooltip: messages.queries.statusTypes.gravity,
      };
    case "DENYLIST":
      return {
        Icon: Ban,
        iconClassName: "bg-red-500/14 text-red-700 ring-1 ring-red-500/20 dark:text-red-200",
        tooltip: messages.queries.statusTypes.gravity,
      };
    default:
      if (!status) {
        return null;
      }

      return {
        Icon: Info,
        iconClassName: "bg-muted text-muted-foreground ring-1 ring-border",
        tooltip: messages.queries.statusTypes.unknown(status),
      };
  }
}

export function QueryStatusCell({
  messages,
  status,
}: Readonly<{
  messages: WebMessages;
  status: string | null;
}>) {
  const visual = getStatusVisual(status, messages);

  if (!status) {
    return <span className="text-muted-foreground">{messages.common.versionUnavailable}</span>;
  }

  return (
    <div className="flex justify-center">
      {visual ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex size-6 cursor-help items-center justify-center rounded-full transition-colors",
                visual.iconClassName,
              )}
              aria-label={visual.tooltip}
            >
              <visual.Icon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{visual.tooltip}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
