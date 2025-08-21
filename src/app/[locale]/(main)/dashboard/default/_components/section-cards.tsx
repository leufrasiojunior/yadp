"use client";

import { useEffect } from "react";

import { TooltipTrigger } from "@radix-ui/react-tooltip";
import { Ban, CircleQuestionMark, Globe, Percent, ShieldBanIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { usePiholeSummary } from "@/hooks/use-pihole-summary";
import { showToast } from "@/lib/toast-function";

export function SectionCards() {
  const t = useTranslations("dashboard.cards");
  const { summary, loading, error } = usePiholeSummary();

  useEffect(() => {
    if (error) {
      showToast("error", "Failed to fetch Pi-hole summary", error?.message, {
        label: "Tentar novamente",
        onClick: () => location.reload(),
      });
    }
  }, [error]);

  if (loading) {
    return (
      <div className=":data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card">
            <div className="flex h-full items-center gap-4 p-4">
              <div className="flex flex-1 flex-col justify-center gap-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-3/4" />
                  <Badge variant="secondary" className="h-6 bg-transparent px-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Skeleton className="" />
                      </TooltipTrigger>
                      <Skeleton className="h-4 w-3/4" />
                    </Tooltip>
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  <Skeleton className="h-6 w-3/4" />
                </CardTitle>
                <Skeleton className="h-6 w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className=":data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <div className="flex h-full items-center gap-4 px-4">
          <div className="flex h-20 w-20 items-center justify-center">
            <Globe className="h-12 w-12" />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-center justify-between">
              <CardDescription>{t("queriesTotal.title")}</CardDescription>
              <Badge variant="secondary" className="h-6 bg-transparent px-2">
                <Tooltip>
                  <TooltipTrigger>
                    <CircleQuestionMark className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>{t("queriesTotal.description")}</TooltipContent>
                </Tooltip>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {summary?.queries.total.toLocaleString()}
            </CardTitle>
          </div>
        </div>
      </Card>

      <Card className="@container/card">
        <div className="flex h-full items-center gap-4 p-4">
          <div className="flex h-20 w-20 items-center justify-center">
            <Ban className="h-12 w-12" />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-center justify-between">
              <CardDescription>{t("queriesBlocked.title")}</CardDescription>
              <Badge variant="secondary" className="h-6 bg-transparent px-2">
                <Tooltip>
                  <TooltipTrigger>
                    <CircleQuestionMark className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>{t("queriesBlocked.description")}</TooltipContent>
                </Tooltip>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {summary?.queries.blocked.toLocaleString()}
            </CardTitle>
          </div>
        </div>
      </Card>

      <Card className="@container/card">
        <div className="flex h-full items-center gap-4 p-4">
          <div className="flex h-20 w-20 items-center justify-center">
            <Percent className="h-12 w-12" />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-center justify-between">
              <CardDescription>{t("queriesPercent.title")}</CardDescription>
              <Badge variant="secondary" className="h-6 bg-transparent px-2">
                <Tooltip>
                  <TooltipTrigger>
                    <CircleQuestionMark className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>{t("queriesPercent.description")}</TooltipContent>
                </Tooltip>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {summary?.queries.percent_blocked.toFixed(2)}%
            </CardTitle>
          </div>
        </div>
      </Card>

      <Card className="@container/card">
        <div className="flex h-full items-center gap-4 p-4">
          <div className="flex h-20 w-20 items-center justify-center">
            <ShieldBanIcon className="h-12 w-12" />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-center justify-between">
              <CardDescription>{t("totalDomains.title")}</CardDescription>
              <Badge variant="secondary" className="h-6 bg-transparent px-2">
                <Tooltip>
                  <TooltipTrigger>
                    <CircleQuestionMark className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>{t("totalDomains.description")}</TooltipContent>
                </Tooltip>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {summary?.gravity.domains_being_blocked.toLocaleString()}
            </CardTitle>
          </div>
        </div>
      </Card>
    </div>
  );
}
