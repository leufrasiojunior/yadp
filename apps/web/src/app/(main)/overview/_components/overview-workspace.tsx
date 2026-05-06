"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  OverviewCoverageRenewResponse,
  OverviewJobDeleteResponse,
  OverviewJobDetailsResponse,
  OverviewJobsResponse,
  OverviewMutationResponse,
  OverviewResponse,
} from "@/lib/api/yapd-types";
import { setClientCookie } from "@/lib/cookie.client";
import { DASHBOARD_SCOPE_COOKIE, type DashboardScope, serializeDashboardScope } from "@/lib/dashboard/dashboard-scope";
import { useWebI18n } from "@/lib/i18n/client";
import {
  buildOverviewQueryFromFilters,
  getOverviewMaxSelectableDateTime,
  type OverviewFilters,
  type OverviewTab,
} from "@/lib/overview/overview-filters";
import { cn } from "@/lib/utils";

function buildOverviewHref(filters: OverviewFilters, timeZone: string, activeTab: OverviewTab) {
  const query = buildOverviewQueryFromFilters(filters, timeZone);
  const searchParams = new URLSearchParams();

  searchParams.set("tab", activeTab);

  for (const [key, value] of Object.entries(query)) {
    searchParams.set(key, `${value}`);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/overview?${queryString}` : "/overview";
}

function getJobBadgeVariant(status: OverviewJobsResponse["jobs"][number]["status"]) {
  switch (status) {
    case "SUCCESS":
      return "default";
    case "PAUSED":
    case "PARTIAL":
      return "secondary";
    case "FAILURE":
      return "destructive";
    default:
      return "outline";
  }
}

function canOpenJobPeriod(job: OverviewJobsResponse["jobs"][number]) {
  if (job.kind === "MANUAL_DELETE") {
    return false;
  }

  return job.status === "SUCCESS" || job.status === "PARTIAL";
}

function getRankingUsableJobs(jobs: OverviewJobsResponse["jobs"]) {
  return jobs.filter((job) => canOpenJobPeriod(job));
}

function getJobPeriodSeconds(job: OverviewJobsResponse["jobs"][number]) {
  return {
    from: Math.floor(new Date(job.requestedFrom).getTime() / 1000),
    until: Math.floor(new Date(job.requestedUntil).getTime() / 1000),
  };
}

function getJobRowClassName(status: OverviewJobsResponse["jobs"][number]["status"]) {
  switch (status) {
    case "RUNNING":
      return "border-l-4 border-l-sky-400/60 bg-sky-500/[0.06] hover:bg-sky-500/[0.10]";
    case "PAUSED":
      return "border-l-4 border-l-amber-400/60 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]";
    case "PARTIAL":
      return "border-l-4 border-l-yellow-500/60 bg-yellow-500/[0.08] hover:bg-yellow-500/[0.12]";
    case "SUCCESS":
      return "border-l-4 border-l-emerald-500/60 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]";
    case "FAILURE":
      return "border-l-4 border-l-rose-500/60 bg-rose-500/[0.07] hover:bg-rose-500/[0.11]";
    default:
      return "border-l-4 border-l-slate-400/60 bg-slate-500/[0.05] hover:bg-slate-500/[0.09]";
  }
}

function canRetryJob(job: OverviewJobsResponse["jobs"][number]) {
  return job.status === "PAUSED" || job.status === "PARTIAL" || job.status === "FAILURE";
}

function canRenewCoverage(window: OverviewResponse["coverage"]["savedWindows"][number]) {
  return window.rowCount > 0 && (window.status === "SUCCESS" || window.status === "PARTIAL");
}

function getJobProgressPercentage(job: OverviewJobsResponse["jobs"][number] | OverviewJobDetailsResponse["job"]) {
  const totalPages = job.progress.totalPages;

  if (totalPages <= 0) {
    if (job.status === "SUCCESS") {
      return 100;
    }

    return job.status === "RUNNING" ? 15 : 0;
  }

  return Math.max(0, Math.min(100, Math.round((job.progress.completedPages / totalPages) * 100)));
}

function getInstanceProgressPercentage(
  instance: OverviewJobDetailsResponse["job"]["progress"]["instanceProgress"][number],
) {
  if (!instance.totalPages || instance.totalPages <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((instance.completedPages / instance.totalPages) * 100)));
}

function getCoverageRenewedOverview(
  current: OverviewResponse,
  renewedWindow: OverviewCoverageRenewResponse["coverageWindow"],
): OverviewResponse {
  const savedWindows = current.coverage.savedWindows.map((item) =>
    item.id === renewedWindow.id ? renewedWindow : item,
  );
  const windows = current.coverage.windows.map((item) => (item.id === renewedWindow.id ? renewedWindow : item));
  const expiringWindows = savedWindows.filter((item) => item.isExpiringSoon);

  return {
    ...current,
    coverage: {
      ...current.coverage,
      windows,
      savedWindows,
      expiringWindows,
      expiringSoonCount: expiringWindows.length,
    },
  };
}

export function OverviewWorkspace({
  initialFilters,
  initialJobs,
  initialOverview,
  initialTab,
  scope,
}: Readonly<{
  initialFilters: OverviewFilters;
  initialJobs: OverviewJobsResponse;
  initialOverview: OverviewResponse;
  initialTab: OverviewTab;
  scope: DashboardScope;
}>) {
  const router = useRouter();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const { formatDateTime, formatFullDateTime, locale, messages, timeZone } = useWebI18n();
  const [filters, setFilters] = useState(initialFilters);
  const [overview, setOverview] = useState(initialOverview);
  const [jobs, setJobs] = useState(initialJobs);
  const [activeTab, setActiveTab] = useState<OverviewTab>(initialTab);
  const [isPending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [isJobsRefreshing, setIsJobsRefreshing] = useState(false);
  const [busyJobAction, setBusyJobAction] = useState<string | null>(null);
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [details, setDetails] = useState<OverviewJobDetailsResponse["job"] | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const maxSelectableDateTime = useMemo(() => getOverviewMaxSelectableDateTime(timeZone), [timeZone]);
  const percentageFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const rankingUsableJobs = useMemo(() => getRankingUsableJobs(jobs.jobs), [jobs.jobs]);
  const rankingQuery = useMemo(() => buildOverviewQueryFromFilters(filters, timeZone), [filters, timeZone]);
  const chartConfig = useMemo(
    () =>
      ({
        totalQueries: {
          label: messages.overview.ranking.queries,
          color: "hsl(var(--chart-1))",
        },
        blockedQueries: {
          label: messages.overview.summary.blockedQueries,
          color: "hsl(var(--chart-4))",
        },
      }) satisfies ChartConfig,
    [messages],
  );
  const selectedRankingJob = useMemo(() => {
    if (rankingQuery.from === undefined || rankingQuery.until === undefined) {
      return null;
    }

    return (
      rankingUsableJobs.find((job) => {
        const period = getJobPeriodSeconds(job);
        return period.from === rankingQuery.from && period.until === rankingQuery.until;
      }) ?? null
    );
  }, [rankingQuery.from, rankingQuery.until, rankingUsableJobs]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (overview.sources.failedInstances.length === 0) {
      return;
    }

    for (const failure of overview.sources.failedInstances) {
      const detail =
        failure.kind === "import_failure" && failure.message.trim().length > 0
          ? messages.overview.partial.importFailureMessage(failure.message)
          : messages.overview.partial.missingDataMessage;
      toast.error(messages.overview.toasts.instanceFailure(failure.instanceName, detail), {
        id: `overview-failure-${failure.instanceId}-${failure.kind}`,
      });
    }
  }, [overview.sources.failedInstances, messages]);

  const refreshJobs = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsJobsRefreshing(true);
      }

      try {
        const { data, response } = await client.GET<OverviewJobsResponse>("/overview/jobs");

        if (!response.ok || !data) {
          if (!silent) {
            toast.error(messages.overview.toasts.jobsRefreshFailed);
          }
          return;
        }

        setJobs(data);
      } finally {
        if (!silent) {
          setIsJobsRefreshing(false);
        }
      }
    },
    [client, messages],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshJobs({ silent: true });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [refreshJobs]);

  const areFiltersWithinClosedWindow = useCallback(() => {
    return filters.from <= maxSelectableDateTime && filters.until <= maxSelectableDateTime;
  }, [filters.from, filters.until, maxSelectableDateTime]);

  const reloadCurrentView = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab !== "request" && nextTab !== "ranking" && nextTab !== "jobs") {
      return;
    }

    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    startTransition(() => {
      router.replace(buildOverviewHref(filters, timeZone, nextTab));
    });
  };

  const triggerJob = async (
    path: "/overview/backfill" | "/overview/delete",
    overrides?: { from: number; until: number },
  ) => {
    if (!overrides && !areFiltersWithinClosedWindow()) {
      toast.error(messages.overview.toasts.currentDayBlocked);
      return;
    }

    const query = overrides ?? buildOverviewQueryFromFilters(filters, timeZone);

    if (query.from === undefined || query.until === undefined) {
      toast.error(messages.overview.toasts.invalidPeriod);
      return;
    }

    setIsMutating(true);

    try {
      const { data, response } = await client.POST<OverviewMutationResponse>(path, {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        body: {
          scope: scope.kind === "all" ? "all" : "instance",
          ...(scope.kind === "instance" ? { instanceId: scope.instanceId } : {}),
          from: query.from,
          until: query.until,
        },
      });

      if (!response.ok || !data) {
        toast.error(
          path === "/overview/backfill"
            ? messages.overview.toasts.backfillFailed
            : messages.overview.toasts.deleteFailed,
        );
        return;
      }

      toast.success(
        path === "/overview/backfill" ? messages.overview.toasts.backfillQueued : messages.overview.toasts.deleteQueued,
      );
      await refreshJobs();
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsMutating(false);
    }
  };

  const navigateToJobPeriod = useCallback(
    (job: OverviewJobsResponse["jobs"][number], historyMode: "push" | "replace" = "push") => {
      const nextScope: DashboardScope =
        job.scope === "instance" && job.instanceId ? { kind: "instance", instanceId: job.instanceId } : { kind: "all" };
      const { from, until } = getJobPeriodSeconds(job);

      setClientCookie(DASHBOARD_SCOPE_COOKIE, serializeDashboardScope(nextScope));

      startTransition(() => {
        const href = `/overview?tab=ranking&from=${from}&until=${until}`;

        if (historyMode === "replace") {
          router.replace(href);
          return;
        }

        router.push(href);
      });
    },
    [router],
  );

  const renewCoverage = async (coverageWindowId: string) => {
    setBusyJobAction(`renew:${coverageWindowId}`);

    try {
      const { data, response } = await client.POST<OverviewCoverageRenewResponse>("/overview/coverage/renew", {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        body: {
          coverageWindowId,
        },
      });

      if (!response.ok || !data) {
        toast.error(messages.overview.toasts.coverageRenewFailed);
        return;
      }

      setOverview((current) => getCoverageRenewedOverview(current, data.coverageWindow));
      toast.success(messages.overview.toasts.coverageRenewed(formatCount(data.renewedQueryCount)));
    } finally {
      setBusyJobAction(null);
    }
  };

  const openJobPeriod = (job: OverviewJobsResponse["jobs"][number]) => {
    navigateToJobPeriod(job);
  };

  const retryJob = async (jobId: string) => {
    setBusyJobAction(`retry:${jobId}`);

    try {
      const { data, response } = await client.POST<OverviewMutationResponse>(`/overview/jobs/${jobId}/retry`, {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
      });

      if (!response.ok || !data) {
        toast.error(messages.overview.toasts.retryFailed);
        return;
      }

      toast.success(messages.overview.toasts.retryQueued);
      await refreshJobs();
      if (detailsJobId === jobId) {
        setDetails(null);
        void loadJobDetails(jobId);
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusyJobAction(null);
    }
  };

  const deleteJob = async (jobId: string) => {
    setBusyJobAction(`delete:${jobId}`);

    try {
      const { data, response } = await client.DELETE<OverviewJobDeleteResponse>(`/overview/jobs/${jobId}`, {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
      });

      if (!response.ok || !data) {
        toast.error(messages.overview.toasts.jobDeleteFailed);
        return;
      }

      setJobs((current) => ({
        jobs: current.jobs.filter((item) => item.id !== jobId),
      }));
      if (detailsJobId === jobId) {
        setDetailsJobId(null);
        setDetails(null);
      }
      toast.success(messages.overview.toasts.jobDeleted);
    } finally {
      setBusyJobAction(null);
    }
  };

  const loadJobDetails = useCallback(
    async (jobId: string) => {
      setIsDetailsLoading(true);

      try {
        const { data, response } = await client.GET<OverviewJobDetailsResponse>(`/overview/jobs/${jobId}/details`);

        if (!response.ok || !data) {
          toast.error(messages.overview.toasts.jobDetailsFailed);
          return;
        }

        setDetails(data.job);
      } finally {
        setIsDetailsLoading(false);
      }
    },
    [client, messages],
  );

  const openJobDetails = async (jobId: string) => {
    setDetailsJobId(jobId);
    setDetails(null);
    await loadJobDetails(jobId);
  };

  const closeJobDetails = () => {
    setDetailsJobId(null);
    setDetails(null);
  };

  const formatCount = (value: number) => numberFormatter.format(value);
  const formatPercentage = (value: number) => `${percentageFormatter.format(value)}%`;
  const chartTitle = messages.overview.chart.titleByHour;
  const selectedRankingJobValue = selectedRankingJob?.id;

  const getJobExecutionOriginLabel = (job: Pick<OverviewJobsResponse["jobs"][number], "kind" | "trigger">) => {
    if (job.kind === "AUTOMATIC_IMPORT") {
      return messages.overview.jobs.detailsOriginAutomatic;
    }

    return messages.overview.jobs.detailsOriginManual;
  };

  const getRankingJobOptionLabel = (job: OverviewJobsResponse["jobs"][number]) => {
    const importedAt = job.finishedAt ?? job.createdAt;

    return [
      messages.overview.jobs.kindValues[job.kind],
      messages.overview.coverage.period(formatDateTime(job.requestedFrom), formatDateTime(job.requestedUntil)),
      messages.overview.ranking.importedAt(formatFullDateTime(importedAt)),
      messages.overview.jobs.statusValues[job.status],
    ].join(" | ");
  };

  const getFailureReasonLabel = (reason: OverviewJobDetailsResponse["job"]["failureReason"] | null) => {
    switch (reason) {
      case "timeout":
        return messages.overview.jobs.failureReason.timeout;
      case "session":
        return messages.overview.jobs.failureReason.session;
      case "server_unavailable":
        return messages.overview.jobs.failureReason.serverUnavailable;
      case "count_mismatch":
        return messages.overview.jobs.failureReason.countMismatch;
      default:
        return messages.overview.jobs.failureReason.unexpected;
    }
  };

  const getJobStatusSummary = (job: OverviewJobsResponse["jobs"][number] | OverviewJobDetailsResponse["job"]) => {
    switch (job.status) {
      case "PENDING":
        return messages.overview.jobs.statusSummary.PENDING;
      case "RUNNING":
        return messages.overview.jobs.statusSummary.RUNNING;
      case "PAUSED":
        return messages.overview.jobs.statusSummary.PAUSED;
      case "PARTIAL":
        return messages.overview.jobs.statusSummary.PARTIAL;
      case "SUCCESS":
        return messages.overview.jobs.statusSummary.SUCCESS;
      case "FAILURE":
        return messages.overview.jobs.statusSummary.FAILURE;
      default:
        return messages.overview.jobs.statusSummary.PENDING;
    }
  };

  const renderRankingTable = (rows: Array<{ value: string; count: number }>, title: string) => (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{messages.overview.ranking.noData}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.overview.ranking.value}</TableHead>
              <TableHead className="text-right">{messages.overview.ranking.queries}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={`${title}-${item.value}`}>
                <TableCell>{item.value}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(item.count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const selectedJobSummary = jobs.jobs.find((job) => job.id === detailsJobId) ?? null;

  useEffect(() => {
    if (activeTab !== "ranking" || selectedRankingJob || rankingUsableJobs.length === 0 || isPending) {
      return;
    }

    const mostRecentJob = rankingUsableJobs[0];
    if (!mostRecentJob) {
      return;
    }

    navigateToJobPeriod(mostRecentJob, "replace");
  }, [activeTab, isPending, navigateToJobPeriod, rankingUsableJobs, selectedRankingJob]);

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4 md:gap-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="request">{messages.overview.tabs.request}</TabsTrigger>
          <TabsTrigger value="ranking">{messages.overview.tabs.ranking}</TabsTrigger>
          <TabsTrigger value="jobs">{messages.overview.tabs.jobs}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="request"
          className="data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 space-y-4 outline-none data-[state=active]:animate-in md:space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.filters.title}</CardTitle>
              <CardDescription>{messages.overview.filters.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="overview-from" className="font-medium text-sm">
                    {messages.overview.filters.from}
                  </label>
                  <Input
                    id="overview-from"
                    type="datetime-local"
                    max={maxSelectableDateTime}
                    value={filters.from}
                    onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="overview-until" className="font-medium text-sm">
                    {messages.overview.filters.until}
                  </label>
                  <Input
                    id="overview-until"
                    type="datetime-local"
                    max={maxSelectableDateTime}
                    value={filters.until}
                    onChange={(event) => setFilters((current) => ({ ...current, until: event.target.value }))}
                  />
                </div>
              </div>

              <p className="text-muted-foreground text-xs">{messages.overview.filters.closedDayHint}</p>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void triggerJob("/overview/backfill")} disabled={isMutating}>
                  {isMutating ? messages.overview.actions.backfillLoading : messages.overview.actions.backfill}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.coverage.title}</CardTitle>
              <CardDescription>{messages.overview.coverage.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm md:grid-cols-5">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{messages.overview.coverage.totalStoredQueries}</p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {formatCount(overview.coverage.totalStoredQueries)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{messages.overview.coverage.earliestStoredAt}</p>
                  <p className="mt-1 font-medium">
                    {overview.coverage.earliestStoredAt
                      ? formatFullDateTime(overview.coverage.earliestStoredAt)
                      : messages.overview.coverage.unavailable}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{messages.overview.coverage.latestStoredAt}</p>
                  <p className="mt-1 font-medium">
                    {overview.coverage.latestStoredAt
                      ? formatFullDateTime(overview.coverage.latestStoredAt)
                      : messages.overview.coverage.unavailable}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{messages.overview.coverage.savedWindows}</p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {formatCount(overview.coverage.savedWindowCount)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{messages.overview.coverage.expiringSoon}</p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {formatCount(overview.coverage.expiringSoonCount)}
                  </p>
                </div>
              </div>

              {overview.coverage.expiringWindows.length > 0 ? (
                <Alert>
                  <AlertTitle>{messages.overview.coverage.expiringSoonTitle}</AlertTitle>
                  <AlertDescription>
                    {messages.overview.coverage.expiringSoonDescription(
                      formatCount(overview.coverage.expiringWindows.length),
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              {overview.coverage.savedWindows.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.coverage.emptyTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.coverage.emptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {overview.coverage.savedWindows.map((window) => (
                    <div key={window.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{window.instanceName}</p>
                          <Badge variant={getJobBadgeVariant(window.status)}>
                            {messages.overview.jobs.statusValues[window.status]}
                          </Badge>
                          {window.isExpiringSoon ? (
                            <Badge variant="secondary">{messages.overview.coverage.expiringSoonBadge}</Badge>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void renewCoverage(window.id)}
                          disabled={busyJobAction !== null || !canRenewCoverage(window)}
                        >
                          {busyJobAction === `renew:${window.id}`
                            ? messages.overview.coverage.renewing
                            : messages.overview.coverage.renew}
                        </Button>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {messages.overview.coverage.period(
                          formatDateTime(window.requestedFrom),
                          formatDateTime(window.requestedUntil),
                        )}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {messages.overview.coverage.capturedQueries(window.rowCount)}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {messages.overview.coverage.expiresAt(formatFullDateTime(window.expiresAt))}
                      </p>
                      {window.errorMessage ? (
                        <p className="mt-2 text-amber-700 text-xs dark:text-amber-300">{window.errorMessage}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="ranking"
          className="data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 space-y-4 outline-none data-[state=active]:animate-in md:space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.ranking.importedJobsTitle}</CardTitle>
              <CardDescription>{messages.overview.ranking.importedJobsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rankingUsableJobs.length > 0 ? (
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor="overview-ranking-job-select">
                    {messages.overview.ranking.selectLabel}
                  </label>
                  <Select
                    value={selectedRankingJobValue}
                    onValueChange={(value) => {
                      const nextJob = rankingUsableJobs.find((job) => job.id === value);
                      if (!nextJob) {
                        return;
                      }

                      openJobPeriod(nextJob);
                    }}
                  >
                    <SelectTrigger id="overview-ranking-job-select" className="w-full md:max-w-3xl">
                      <SelectValue placeholder={messages.overview.ranking.selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectGroup>
                        <SelectLabel>{messages.overview.ranking.selectLabel}</SelectLabel>
                        {rankingUsableJobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {getRankingJobOptionLabel(job)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <Alert>
                <AlertTitle>{messages.overview.ranking.nativeWindowNoticeTitle}</AlertTitle>
                <AlertDescription>{messages.overview.ranking.nativeWindowNoticeDescription}</AlertDescription>
              </Alert>

              {rankingUsableJobs.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.ranking.emptyImportedTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.ranking.emptyImportedDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={reloadCurrentView} disabled={isPending}>
                  {messages.overview.filters.reload}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    selectedRankingJob
                      ? void triggerJob("/overview/delete", getJobPeriodSeconds(selectedRankingJob))
                      : undefined
                  }
                  disabled={isMutating || !selectedRankingJob}
                >
                  {isMutating ? messages.overview.actions.deletePeriodLoading : messages.overview.actions.deletePeriod}
                </Button>
              </div>
            </CardContent>
          </Card>

          {overview.sources.failedInstances.length > 0 ? (
            <Alert>
              <AlertTitle>{messages.overview.partial.title}</AlertTitle>
              <AlertDescription>{messages.overview.partial.description}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>{messages.overview.summary.totalQueries}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatCount(overview.summary.totalQueries)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{messages.overview.summary.blockedQueries}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatCount(overview.summary.blockedQueries)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{messages.overview.summary.uniqueClients}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatCount(overview.summary.uniqueClients)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{messages.overview.summary.percentageBlocked}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {formatPercentage(overview.summary.percentageBlocked)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>{chartTitle}</CardTitle>
                <CardDescription>{messages.overview.chart.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.charts.queries.points.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                      <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
                    <AreaChart data={overview.charts.queries.points}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value: string) => formatDateTime(value)}
                        minTickGap={24}
                      />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip
                        content={<ChartTooltipContent labelFormatter={(value) => formatDateTime(String(value))} />}
                      />
                      <Area
                        dataKey="totalQueries"
                        type="monotone"
                        fill="var(--color-totalQueries)"
                        fillOpacity={0.2}
                        stroke="var(--color-totalQueries)"
                        strokeWidth={2}
                      />
                      <Area
                        dataKey="blockedQueries"
                        type="monotone"
                        fill="var(--color-blockedQueries)"
                        fillOpacity={0.14}
                        stroke="var(--color-blockedQueries)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.title}</CardTitle>
                <CardDescription>{messages.overview.ranking.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderRankingTable(overview.rankings.domains, messages.overview.ranking.domains)}
                {renderRankingTable(overview.rankings.clients, messages.overview.ranking.clients)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.upstreams}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderRankingTable(overview.rankings.upstreams, messages.overview.ranking.upstreams)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.statuses}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderRankingTable(overview.rankings.statuses, messages.overview.ranking.statuses)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="jobs"
          className="data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 space-y-4 outline-none data-[state=active]:animate-in md:space-y-6"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>{messages.overview.jobs.title}</CardTitle>
                <CardDescription>{messages.overview.jobs.description}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshJobs()} disabled={isJobsRefreshing}>
                {isJobsRefreshing ? messages.overview.jobs.refreshing : messages.overview.jobs.refresh}
              </Button>
            </CardHeader>
            <CardContent>
              {jobs.jobs.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.jobs.emptyTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.jobs.emptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.overview.jobs.status}</TableHead>
                      <TableHead>{messages.overview.jobs.type}</TableHead>
                      <TableHead>{messages.overview.jobs.period}</TableHead>
                      <TableHead>{messages.overview.jobs.progress}</TableHead>
                      <TableHead className="text-right">{messages.overview.jobs.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.jobs.map((job) => (
                      <TableRow key={job.id} className={cn("transition-colors", getJobRowClassName(job.status))}>
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            <Badge variant={getJobBadgeVariant(job.status)}>
                              {messages.overview.jobs.statusValues[job.status]}
                            </Badge>
                            <p className="text-muted-foreground text-xs">{getJobStatusSummary(job)}</p>
                            {job.progress.lastFailureMessage ? (
                              <p className="max-w-sm text-muted-foreground text-xs">
                                {getFailureReasonLabel(job.failureReason)}: {job.progress.lastFailureMessage}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">{messages.overview.jobs.kindValues[job.kind]}</TableCell>
                        <TableCell className="align-top text-muted-foreground text-sm">
                          <div>{formatDateTime(job.requestedFrom)}</div>
                          <div>{formatDateTime(job.requestedUntil)}</div>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <div className="space-y-1">
                            <p className="font-medium tabular-nums">
                              {job.kind === "MANUAL_DELETE"
                                ? formatCount(job.deletedCount)
                                : messages.overview.jobs.progressSummary(
                                    formatCount(job.progress.totalInsertedRecords),
                                    formatCount(job.progress.totalExpectedRecords),
                                  )}
                            </p>
                            {job.kind !== "MANUAL_DELETE" ? (
                              <p className="text-muted-foreground text-xs">
                                {messages.overview.jobs.pagesSummary(
                                  formatCount(job.progress.completedPages),
                                  formatCount(job.progress.totalPages),
                                )}
                              </p>
                            ) : null}
                            {job.kind !== "MANUAL_DELETE" ? (
                              <Progress
                                value={getJobProgressPercentage(job)}
                                className="mt-2 h-2"
                                aria-label={messages.overview.jobs.progress}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void openJobDetails(job.id)}
                              disabled={busyJobAction !== null}
                            >
                              {messages.overview.jobs.viewDetails}
                            </Button>
                            {canOpenJobPeriod(job) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openJobPeriod(job)}
                                disabled={busyJobAction !== null}
                              >
                                {messages.overview.jobs.openPeriod}
                              </Button>
                            ) : job.status === "RUNNING" || job.status === "PENDING" ? (
                              <span className="self-center text-muted-foreground text-sm">
                                {messages.overview.jobs.runningHint}
                              </span>
                            ) : null}
                            {canRetryJob(job) ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void retryJob(job.id)}
                                disabled={busyJobAction !== null}
                              >
                                {messages.overview.jobs.retry}
                              </Button>
                            ) : null}
                            {job.status === "SUCCESS" ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void deleteJob(job.id)}
                                disabled={busyJobAction !== null}
                              >
                                {messages.overview.jobs.delete}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailsJobId !== null} onOpenChange={(open) => !open && closeJobDetails()}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{messages.overview.jobs.detailsTitle}</DialogTitle>
            <DialogDescription>
              {selectedJobSummary || details
                ? messages.overview.jobs.detailsDescription(
                    formatDateTime(
                      selectedJobSummary?.requestedFrom ?? details?.requestedFrom ?? new Date().toISOString(),
                    ),
                    formatDateTime(
                      selectedJobSummary?.requestedUntil ?? details?.requestedUntil ?? new Date().toISOString(),
                    ),
                  )
                : messages.overview.jobs.description}
            </DialogDescription>
          </DialogHeader>

          {isDetailsLoading || !details ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
              {messages.overview.jobs.detailsLoading}
            </div>
          ) : (
            <Tabs key={details.id} defaultValue="summary" className="flex min-h-0 flex-1 flex-col gap-4">
              <TabsList className="grid w-full shrink-0 grid-cols-3">
                <TabsTrigger value="summary">{messages.overview.jobs.detailsTabSummary}</TabsTrigger>
                <TabsTrigger value="instances">{messages.overview.jobs.detailsTabInstances}</TabsTrigger>
                <TabsTrigger value="timeline">{messages.overview.jobs.detailsTabTimeline}</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-0 min-h-0 flex-1 overflow-hidden outline-none">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-1">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.status}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={getJobBadgeVariant(details.status)}>
                            {messages.overview.jobs.statusValues[details.status]}
                          </Badge>
                          {details.failureReason ? (
                            <span className="text-muted-foreground text-xs">
                              {getFailureReasonLabel(details.failureReason)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsScope}</p>
                        <p className="mt-2 font-semibold">
                          {details.scope === "instance"
                            ? details.instanceName
                            : messages.overview.jobs.detailsAllInstances}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsPeriodLabel}</p>
                        <p className="mt-2 font-semibold text-xs">{formatDateTime(details.requestedFrom)}</p>
                        <p className="text-muted-foreground text-xs">{formatDateTime(details.requestedUntil)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsOrigin}</p>
                        <p className="mt-2 font-semibold">{getJobExecutionOriginLabel(details)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsRecordsFiltered}</p>
                        <p className="mt-2 font-semibold tabular-nums">
                          {formatCount(details.progress.totalExpectedRecords)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsTotalPages}</p>
                        <p className="mt-2 font-semibold tabular-nums">{formatCount(details.progress.totalPages)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsSaved}</p>
                        <p className="mt-2 font-semibold tabular-nums">
                          {formatCount(details.progress.totalInsertedRecords)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{messages.overview.jobs.detailsAttempts}</p>
                        <p className="mt-2 font-semibold tabular-nums">{formatCount(details.progress.attempts)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      {details.kind !== "MANUAL_DELETE" ? (
                        <Card>
                          <CardContent className="space-y-3 pt-6">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-sm">{messages.overview.jobs.detailsProgressTitle}</p>
                                <p className="text-muted-foreground text-xs">{getJobStatusSummary(details)}</p>
                              </div>
                              <p className="font-semibold text-sm tabular-nums">
                                {formatPercentage(getJobProgressPercentage(details))}
                              </p>
                            </div>
                            <Progress value={getJobProgressPercentage(details)} className="h-2" />
                            <p className="text-muted-foreground text-xs">
                              {messages.overview.jobs.pagesSummary(
                                formatCount(details.progress.completedPages),
                                formatCount(details.progress.totalPages),
                              )}
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className="space-y-2 pt-6">
                            <p className="font-medium text-sm">{messages.overview.jobs.detailsProgressTitle}</p>
                            <p className="font-semibold tabular-nums">{formatCount(details.deletedCount)}</p>
                            <p className="text-muted-foreground text-xs">{getJobStatusSummary(details)}</p>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">{messages.overview.jobs.detailsExecutionTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p>
                            {messages.overview.jobs.detailsCreatedAt}:{" "}
                            <span className="font-medium">{formatFullDateTime(details.createdAt)}</span>
                          </p>
                          <p>
                            {messages.overview.jobs.detailsStartedAt}:{" "}
                            <span className="font-medium">
                              {details.startedAt
                                ? formatFullDateTime(details.startedAt)
                                : messages.overview.jobs.detailsUnavailable}
                            </span>
                          </p>
                          <p>
                            {messages.overview.jobs.detailsFinishedAt}:{" "}
                            <span className="font-medium">
                              {details.finishedAt
                                ? formatFullDateTime(details.finishedAt)
                                : messages.overview.jobs.detailsUnavailable}
                            </span>
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {details.progress.lastFailureMessage ? (
                      <Alert variant="destructive">
                        <AlertTitle>{messages.overview.jobs.detailsFailureTitle}</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{getFailureReasonLabel(details.failureReason)}</p>
                          <p>{details.progress.lastFailureMessage}</p>
                          <p className="text-xs">
                            {[
                              details.diagnostics.stalledInstanceName
                                ? messages.overview.jobs.detailsFailureInstance(details.diagnostics.stalledInstanceName)
                                : null,
                              details.diagnostics.stalledPage
                                ? messages.overview.jobs.detailsFailurePage(
                                    formatCount(details.diagnostics.stalledPage),
                                  )
                                : null,
                              details.diagnostics.nextRetryAt
                                ? messages.overview.jobs.detailsRetryAt(
                                    formatFullDateTime(details.diagnostics.nextRetryAt),
                                  )
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">{messages.overview.jobs.detailsLastSuccessTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {details.diagnostics.lastSuccessfulInstanceName ? (
                            <>
                              <p>
                                {messages.overview.jobs.detailsLastSuccessInstance(
                                  details.diagnostics.lastSuccessfulInstanceName,
                                )}
                              </p>
                              {details.diagnostics.lastSuccessfulPage ? (
                                <p>
                                  {messages.overview.jobs.detailsLastSuccessPage(
                                    formatCount(details.diagnostics.lastSuccessfulPage),
                                  )}
                                </p>
                              ) : null}
                              {details.diagnostics.lastSuccessfulAt ? (
                                <p>
                                  {messages.overview.jobs.detailsLastSuccessAt(
                                    formatFullDateTime(details.diagnostics.lastSuccessfulAt),
                                  )}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-muted-foreground">{messages.overview.jobs.detailsNoCheckpoint}</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">{messages.overview.jobs.detailsStalledTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {details.diagnostics.stalledInstanceName ||
                          details.diagnostics.stalledPage ||
                          details.diagnostics.stalledStart !== null ? (
                            <>
                              {details.diagnostics.stalledInstanceName ? (
                                <p>
                                  {messages.overview.jobs.detailsStalledInstance(
                                    details.diagnostics.stalledInstanceName,
                                  )}
                                </p>
                              ) : null}
                              {details.diagnostics.stalledPage ? (
                                <p>
                                  {messages.overview.jobs.detailsStalledPage(
                                    formatCount(details.diagnostics.stalledPage),
                                  )}
                                </p>
                              ) : null}
                              {details.diagnostics.stalledStart !== null ? (
                                <p>
                                  {messages.overview.jobs.detailsStalledStart(
                                    formatCount(details.diagnostics.stalledStart),
                                  )}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-muted-foreground">{messages.overview.jobs.detailsNoCheckpoint}</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{messages.overview.jobs.detailsCheckpointTitle}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {details.progress.checkpoint ? (
                          <>
                            <p>
                              {messages.overview.jobs.detailsCheckpointInstance}:{" "}
                              <span className="font-medium">{details.progress.checkpoint.instanceName}</span>
                            </p>
                            <p>
                              {messages.overview.jobs.detailsCheckpointPage}:{" "}
                              <span className="font-medium tabular-nums">{details.progress.checkpoint.page ?? 0}</span>
                            </p>
                            <p>
                              {messages.overview.jobs.detailsCheckpointStart}:{" "}
                              <span className="font-medium tabular-nums">
                                {formatCount(details.progress.checkpoint.start ?? 0)}
                              </span>
                            </p>
                            <p>
                              {messages.overview.jobs.detailsCheckpointFailures}:{" "}
                              <span className="font-medium tabular-nums">
                                {formatCount(details.progress.checkpoint.consecutiveFailures)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">{messages.overview.jobs.detailsNoCheckpoint}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="instances" className="mt-0 min-h-0 flex-1 overflow-hidden outline-none">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3 pb-1">
                    {details.progress.instanceProgress.map((item) => {
                      const instancePercentage = getInstanceProgressPercentage(item);

                      return (
                        <div key={item.instanceId} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{item.instanceName}</p>
                            <Badge variant={getJobBadgeVariant(item.status)}>
                              {messages.overview.jobs.statusValues[item.status]}
                            </Badge>
                          </div>
                          <p className="mt-2 text-muted-foreground">
                            {messages.overview.jobs.progressSummary(
                              formatCount(item.insertedRecords),
                              formatCount(item.expectedRecords ?? 0),
                            )}
                          </p>
                          <p className="text-muted-foreground">
                            {messages.overview.jobs.pagesSummary(
                              formatCount(item.completedPages),
                              formatCount(item.totalPages ?? 0),
                            )}
                          </p>
                          {instancePercentage !== null ? (
                            <p className="mt-1 text-muted-foreground text-xs">
                              {messages.overview.jobs.detailsCompletedPercentage}:{" "}
                              <span className="font-medium">{formatPercentage(instancePercentage)}</span>
                            </p>
                          ) : null}
                          {item.lastErrorMessage ? (
                            <p className="mt-2 text-amber-700 text-xs dark:text-amber-300">{item.lastErrorMessage}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="timeline" className="mt-0 min-h-0 flex-1 overflow-hidden outline-none">
                <ScrollArea className="h-full pr-4">
                  {details.timeline.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{messages.overview.jobs.detailsNoTimeline}</p>
                  ) : (
                    <div className="space-y-3 pb-1">
                      {details.timeline.map(
                        (event: OverviewJobDetailsResponse["job"]["timeline"][number], index: number) => (
                          <div key={`${event.at}-${index}`} className="rounded-lg border p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    event.level === "error"
                                      ? "destructive"
                                      : event.level === "warn"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {event.level}
                                </Badge>
                                <span className="font-medium">{event.type}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">{formatFullDateTime(event.at)}</span>
                            </div>
                            <p className="mt-2">{event.message}</p>
                            {event.instanceName || event.page || event.start !== null ? (
                              <p className="mt-2 text-muted-foreground text-xs">
                                {[
                                  event.instanceName
                                    ? `${messages.overview.jobs.detailsCheckpointInstance}: ${event.instanceName}`
                                    : null,
                                  event.page ? `${messages.overview.jobs.detailsCheckpointPage}: ${event.page}` : null,
                                  event.start !== null
                                    ? `${messages.overview.jobs.detailsCheckpointStart}: ${formatCount(event.start)}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
