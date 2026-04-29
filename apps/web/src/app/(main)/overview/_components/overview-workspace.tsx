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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  OverviewJobDeleteResponse,
  OverviewJobsResponse,
  OverviewMutationResponse,
  OverviewResponse,
} from "@/lib/api/yapd-types";
import { setClientCookie } from "@/lib/cookie.client";
import { DASHBOARD_SCOPE_COOKIE, type DashboardScope, serializeDashboardScope } from "@/lib/dashboard/dashboard-scope";
import { useWebI18n } from "@/lib/i18n/client";
import { buildOverviewQueryFromFilters, type OverviewFilters, type OverviewTab } from "@/lib/overview/overview-filters";

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
    case "PARTIAL":
      return "secondary";
    case "FAILURE":
      return "destructive";
    default:
      return "outline";
  }
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
  const [jobs, setJobs] = useState(initialJobs);
  const [activeTab, setActiveTab] = useState<OverviewTab>(initialTab);
  const [isPending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [isJobsRefreshing, setIsJobsRefreshing] = useState(false);
  const [busyJobAction, setBusyJobAction] = useState<string | null>(null);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percentageFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
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

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialOverview.sources.failedInstances.length === 0) {
      return;
    }

    for (const failure of initialOverview.sources.failedInstances) {
      const detail =
        failure.kind === "import_failure" && failure.message.trim().length > 0
          ? messages.overview.partial.importFailureMessage(failure.message)
          : messages.overview.partial.missingDataMessage;
      toast.error(messages.overview.toasts.instanceFailure(failure.instanceName, detail), {
        id: `overview-failure-${failure.instanceId}-${failure.kind}`,
      });
    }
  }, [initialOverview.sources.failedInstances, messages]);

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

  const applyFilters = () => {
    startTransition(() => {
      router.replace(buildOverviewHref(filters, timeZone, activeTab));
    });
  };

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

  const triggerJob = async (path: "/overview/backfill" | "/overview/delete") => {
    const query = buildOverviewQueryFromFilters(filters, timeZone);

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

  const formatCount = (value: number) => numberFormatter.format(value);
  const formatPercentage = (value: number) => `${percentageFormatter.format(value)}%`;
  const chartTitle = messages.overview.chart.titleByHour;

  const openJobPeriod = (job: OverviewJobsResponse["jobs"][number]) => {
    const nextScope: DashboardScope =
      job.scope === "instance" && job.instanceId ? { kind: "instance", instanceId: job.instanceId } : { kind: "all" };
    const nextTab = job.kind === "MANUAL_DELETE" ? "request" : "ranking";
    setClientCookie(DASHBOARD_SCOPE_COOKIE, serializeDashboardScope(nextScope));
    startTransition(() => {
      router.push(
        `/overview?tab=${nextTab}&from=${Math.floor(new Date(job.requestedFrom).getTime() / 1000)}&until=${Math.floor(new Date(job.requestedUntil).getTime() / 1000)}`,
      );
    });
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
      toast.success(messages.overview.toasts.jobDeleted);
    } finally {
      setBusyJobAction(null);
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

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4 md:gap-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="request">{messages.overview.tabs.request}</TabsTrigger>
        <TabsTrigger value="ranking">{messages.overview.tabs.ranking}</TabsTrigger>
        <TabsTrigger value="jobs">{messages.overview.tabs.jobs}</TabsTrigger>
      </TabsList>

      <TabsContent value="request" className="space-y-4 md:space-y-6">
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
                  value={filters.until}
                  onChange={(event) => setFilters((current) => ({ ...current, until: event.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={applyFilters} disabled={isPending}>
                {isPending ? messages.overview.filters.applying : messages.overview.filters.apply}
              </Button>
              <Button variant="outline" onClick={reloadCurrentView} disabled={isPending}>
                {messages.overview.filters.reload}
              </Button>
              <Button variant="secondary" onClick={() => void triggerJob("/overview/backfill")} disabled={isMutating}>
                {isMutating ? messages.overview.actions.backfillLoading : messages.overview.actions.backfill}
              </Button>
              <Button variant="destructive" onClick={() => void triggerJob("/overview/delete")} disabled={isMutating}>
                {isMutating ? messages.overview.actions.deletePeriodLoading : messages.overview.actions.deletePeriod}
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
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">{messages.overview.coverage.totalStoredQueries}</p>
                <p className="mt-1 font-semibold text-xl tabular-nums">
                  {formatCount(initialOverview.coverage.totalStoredQueries)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">{messages.overview.coverage.earliestStoredAt}</p>
                <p className="mt-1 font-medium">
                  {initialOverview.coverage.earliestStoredAt
                    ? formatFullDateTime(initialOverview.coverage.earliestStoredAt)
                    : messages.overview.coverage.unavailable}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">{messages.overview.coverage.latestStoredAt}</p>
                <p className="mt-1 font-medium">
                  {initialOverview.coverage.latestStoredAt
                    ? formatFullDateTime(initialOverview.coverage.latestStoredAt)
                    : messages.overview.coverage.unavailable}
                </p>
              </div>
            </div>

            {initialOverview.coverage.windows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{messages.overview.coverage.emptyTitle}</EmptyTitle>
                  <EmptyDescription>{messages.overview.coverage.emptyDescription}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {initialOverview.coverage.windows.slice(0, 6).map((window) => (
                  <div key={window.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{window.instanceName}</p>
                      <Badge variant={getJobBadgeVariant(window.status)}>
                        {messages.overview.jobs.statusValues[window.status]}
                      </Badge>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ranking" className="space-y-4 md:space-y-6">
        {initialOverview.sources.failedInstances.length > 0 ? (
          <Alert>
            <AlertTitle>{messages.overview.partial.title}</AlertTitle>
            <AlertDescription>{messages.overview.partial.description}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>{messages.overview.summary.totalQueries}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatCount(initialOverview.summary.totalQueries)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{messages.overview.summary.blockedQueries}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatCount(initialOverview.summary.blockedQueries)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{messages.overview.summary.uniqueClients}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatCount(initialOverview.summary.uniqueClients)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{messages.overview.summary.percentageBlocked}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatPercentage(initialOverview.summary.percentageBlocked)}
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
              {initialOverview.charts.queries.points.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
                  <AreaChart data={initialOverview.charts.queries.points}>
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
              {renderRankingTable(initialOverview.rankings.domains, messages.overview.ranking.domains)}
              {renderRankingTable(initialOverview.rankings.clients, messages.overview.ranking.clients)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.ranking.upstreams}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRankingTable(initialOverview.rankings.upstreams, messages.overview.ranking.upstreams)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.ranking.statuses}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRankingTable(initialOverview.rankings.statuses, messages.overview.ranking.statuses)}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="jobs" className="space-y-4 md:space-y-6">
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
                    <TableHead className="text-right">{messages.overview.jobs.rows}</TableHead>
                    <TableHead className="text-right">{messages.overview.jobs.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Badge variant={getJobBadgeVariant(job.status)}>
                          {messages.overview.jobs.statusValues[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{messages.overview.jobs.kindValues[job.kind]}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div>{formatDateTime(job.requestedFrom)}</div>
                        <div>{formatDateTime(job.requestedUntil)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(job.kind === "MANUAL_DELETE" ? job.deletedCount : job.queryCount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {job.status === "SUCCESS" || job.status === "PARTIAL" || job.status === "FAILURE" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openJobPeriod(job)}
                              disabled={busyJobAction !== null}
                            >
                              {messages.overview.jobs.openPeriod}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">{messages.overview.jobs.runningHint}</span>
                          )}
                          {job.status === "PARTIAL" || job.status === "FAILURE" ? (
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
  );
}
