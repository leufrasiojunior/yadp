"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  FileText,
  Filter,
  Globe,
  Info,
  ListFilter,
  type LucideIcon,
  Monitor,
  RefreshCw,
  Server,
  ShieldBan,
  TriangleAlert,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
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
  type OverviewGroupBy,
  type OverviewTab,
} from "@/lib/overview/overview-filters";
import { cn } from "@/lib/utils";

const CLIENT_FILTER_ALL_VALUE = "__all_clients__";
const RANKING_SHARE_LIMIT = 5;
const MAX_COMPLETE_CHART_BUCKETS = 5000;
const DETAILS_POLL_INTERVAL_MS = 2000;
const COVERAGE_PAGE_SIZE = 6;
const JOB_STATUS_FILTER_VALUES = ["SUCCESS", "PARTIAL", "FAILURE"] as const;
const STATUS_CHART_COLORS = [
  "oklch(0.62 0.2 145)",
  "oklch(0.72 0.18 72)",
  "oklch(0.62 0.22 24)",
  "oklch(0.58 0.18 252)",
  "oklch(0.62 0.18 315)",
] as const;
const RANKING_CHART_COLORS = [
  "oklch(0.58 0.18 252)",
  "oklch(0.62 0.2 145)",
  "oklch(0.72 0.18 72)",
  "oklch(0.62 0.18 315)",
  "oklch(0.62 0.22 24)",
  "oklch(0.54 0.12 250)",
] as const;

type RankingFilterKey = "domain" | "client_ip";
type RankingRow = { value: string; count: number };
type QueryChartPoint = OverviewResponse["charts"]["queries"]["points"][number];
type OverviewJobStatus = OverviewJobsResponse["jobs"][number]["status"];
type OverviewJobFilterStatus = (typeof JOB_STATUS_FILTER_VALUES)[number];
type RankingShareRow = RankingRow & {
  fill: string;
  percentage: number;
};
type HourlyAccessRow = {
  hour: number;
  label: string;
  totalQueries: number;
  blockedQueries: number;
  allowedQueries: number;
  percentageBlocked: number;
};
type RankingKpiCard = {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  accentClassName: string;
};
type DetailsLoadOptions = {
  silent?: boolean;
};

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

function canShowCoverageWindow(window: OverviewResponse["coverage"]["savedWindows"][number]) {
  return window.status === "SUCCESS" || window.status === "PARTIAL";
}

function isOverviewJobFilterStatus(status: OverviewJobStatus): status is OverviewJobFilterStatus {
  return status === "SUCCESS" || status === "PARTIAL" || status === "FAILURE";
}

function isLiveOverviewJobStatus(status: OverviewJobStatus) {
  return status === "PENDING" || status === "RUNNING";
}

function canDeleteJob(job: OverviewJobsResponse["jobs"][number]) {
  return job.status === "SUCCESS" || job.status === "FAILURE";
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

function deduplicateRankingRows(rows: Array<{ value: string; count: number }>) {
  const countsByValue = new Map<string, number>();

  for (const row of rows) {
    const value = row.value.trim();

    if (value.length === 0) {
      continue;
    }

    countsByValue.set(value, (countsByValue.get(value) ?? 0) + row.count);
  }

  return [...countsByValue.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function getPeakPoint(points: QueryChartPoint[], key: "totalQueries" | "blockedQueries") {
  return (
    points.reduce<QueryChartPoint | null>((peak, point) => {
      if (!peak || point[key] > peak[key]) {
        return point;
      }

      return peak;
    }, null) ?? null
  );
}

function getRankingLeader(rows: RankingRow[], totalQueries: number) {
  const [leader] = rows;

  if (!leader) {
    return null;
  }

  return {
    ...leader,
    percentage: totalQueries > 0 ? (leader.count / totalQueries) * 100 : 0,
  };
}

function getBucketStart(value: string, groupBy: OverviewGroupBy) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (groupBy === "day") {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  date.setUTCMinutes(0, 0, 0);
  return date;
}

function addBucket(date: Date, groupBy: OverviewGroupBy) {
  const next = new Date(date);

  if (groupBy === "day") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

function createEmptyChartPoint(timestamp: string): QueryChartPoint {
  return {
    timestamp,
    totalQueries: 0,
    blockedQueries: 0,
    cachedQueries: 0,
    forwardedQueries: 0,
    percentageBlocked: 0,
  };
}

function buildCompleteQueryPoints(points: QueryChartPoint[], from: string, until: string, groupBy: OverviewGroupBy) {
  if (points.length === 0) {
    return points;
  }

  const firstBucket = getBucketStart(from, groupBy);
  const lastBucket = getBucketStart(until, groupBy);

  if (!firstBucket || !lastBucket || firstBucket > lastBucket) {
    return points;
  }

  const pointsByBucket = new Map(
    points.flatMap((point) => {
      const bucket = getBucketStart(point.timestamp, groupBy);
      return bucket ? [[bucket.toISOString(), point] as const] : [];
    }),
  );
  const completePoints: QueryChartPoint[] = [];
  let cursor = firstBucket;

  while (cursor <= lastBucket) {
    if (completePoints.length >= MAX_COMPLETE_CHART_BUCKETS) {
      return points;
    }

    const timestamp = cursor.toISOString();
    completePoints.push(pointsByBucket.get(timestamp) ?? createEmptyChartPoint(timestamp));
    cursor = addBucket(cursor, groupBy);
  }

  return completePoints;
}

function buildRankingShareRows(
  rows: RankingRow[],
  totalQueries: number,
  otherLabel: string,
  colors: readonly string[],
): RankingShareRow[] {
  const getColor = (index: number) => colors[index % colors.length] ?? "var(--chart-2)";
  const topRows = rows.slice(0, RANKING_SHARE_LIMIT).map((row, index) => ({
    ...row,
    fill: getColor(index),
    percentage: totalQueries > 0 ? (row.count / totalQueries) * 100 : 0,
  }));
  const representedQueries = topRows.reduce((total, row) => total + row.count, 0);
  const otherQueries = Math.max(0, totalQueries - representedQueries);

  if (otherQueries <= 0) {
    return topRows;
  }

  return [
    ...topRows,
    {
      value: otherLabel,
      count: otherQueries,
      fill: getColor(topRows.length),
      percentage: totalQueries > 0 ? (otherQueries / totalQueries) * 100 : 0,
    },
  ];
}

function getLocalHour(timestamp: string, timeZone: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour");
  const hour = Number(hourPart?.value);

  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function buildHourlyAccessRows(points: QueryChartPoint[], timeZone: string): HourlyAccessRow[] {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    totalQueries: 0,
    blockedQueries: 0,
    allowedQueries: 0,
    percentageBlocked: 0,
  }));

  for (const point of points) {
    const hour = getLocalHour(point.timestamp, timeZone);

    if (hour === null) {
      continue;
    }

    const row = rows[hour];

    if (!row) {
      continue;
    }

    row.totalQueries += point.totalQueries;
    row.blockedQueries += point.blockedQueries;
  }

  return rows.map((row) => {
    const allowedQueries = Math.max(0, row.totalQueries - row.blockedQueries);

    return {
      ...row,
      allowedQueries,
      percentageBlocked: row.totalQueries > 0 ? (row.blockedQueries / row.totalQueries) * 100 : 0,
    };
  });
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
  const [detailsLastUpdatedAt, setDetailsLastUpdatedAt] = useState<string | null>(null);
  const [showUpstreams, setShowUpstreams] = useState(false);
  const [coveragePage, setCoveragePage] = useState(1);
  const [jobStatusFilters, setJobStatusFilters] = useState<Record<OverviewJobFilterStatus, boolean>>({
    SUCCESS: true,
    PARTIAL: true,
    FAILURE: true,
  });
  const detailsRequestTokenRef = useRef(0);
  const detailsRequestInFlightRef = useRef<string | null>(null);
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
  const rankingClientRows = useMemo(
    () => deduplicateRankingRows(overview.rankings.clients),
    [overview.rankings.clients],
  );
  const queryChartPoints = useMemo(
    () =>
      buildCompleteQueryPoints(
        overview.charts.queries.points,
        overview.filters.from,
        overview.filters.until,
        overview.charts.queries.groupBy,
      ),
    [overview.charts.queries.groupBy, overview.charts.queries.points, overview.filters.from, overview.filters.until],
  );
  const rankingClientOptions = useMemo(() => {
    if (!filters.client_ip || rankingClientRows.some((row) => row.value === filters.client_ip)) {
      return rankingClientRows;
    }

    return [{ value: filters.client_ip, count: 0 }, ...rankingClientRows];
  }, [filters.client_ip, rankingClientRows]);
  const hasRankingFilters =
    filters.domain.trim().length > 0 || filters.client_ip.trim().length > 0 || filters.groupBy !== "hour";
  const domainShareRows = useMemo(
    () =>
      buildRankingShareRows(
        overview.rankings.domains,
        overview.summary.totalQueries,
        messages.overview.ranking.analytics.other,
        RANKING_CHART_COLORS,
      ),
    [messages, overview.rankings.domains, overview.summary.totalQueries],
  );
  const clientShareRows = useMemo(
    () =>
      buildRankingShareRows(
        rankingClientRows,
        overview.summary.totalQueries,
        messages.overview.ranking.analytics.other,
        RANKING_CHART_COLORS,
      ),
    [messages, overview.summary.totalQueries, rankingClientRows],
  );
  const statusChartRows = useMemo(
    () =>
      buildRankingShareRows(
        overview.rankings.statuses,
        overview.summary.totalQueries,
        messages.overview.ranking.analytics.other,
        STATUS_CHART_COLORS,
      ),
    [messages, overview.rankings.statuses, overview.summary.totalQueries],
  );
  const hourlyAccessRows = useMemo(
    () =>
      overview.charts.queries.groupBy === "hour"
        ? buildHourlyAccessRows(queryChartPoints, timeZone)
        : ([] satisfies HourlyAccessRow[]),
    [overview.charts.queries.groupBy, queryChartPoints, timeZone],
  );
  const chartConfig = useMemo(
    () =>
      ({
        totalQueries: {
          label: messages.overview.ranking.queries,
          color: "var(--chart-2)",
        },
        blockedQueries: {
          label: messages.overview.summary.blockedQueries,
          color: "var(--destructive)",
        },
      }) satisfies ChartConfig,
    [messages],
  );
  const hourlyAccessChartConfig = useMemo(
    () =>
      ({
        allowedQueries: {
          label: messages.overview.ranking.analytics.allowedQueries,
          color: "var(--chart-2)",
        },
        blockedQueries: {
          label: messages.overview.ranking.analytics.blockedQueries,
          color: "var(--destructive)",
        },
      }) satisfies ChartConfig,
    [messages],
  );
  const shareChartConfig = useMemo(
    () =>
      ({
        count: {
          label: messages.overview.ranking.queries,
          color: "var(--chart-2)",
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
  const coverageWindows = useMemo(
    () => overview.coverage.savedWindows.filter(canShowCoverageWindow),
    [overview.coverage.savedWindows],
  );
  const coveragePageCount = Math.max(1, Math.ceil(coverageWindows.length / COVERAGE_PAGE_SIZE));
  const paginatedCoverageWindows = useMemo(() => {
    const start = (coveragePage - 1) * COVERAGE_PAGE_SIZE;
    return coverageWindows.slice(start, start + COVERAGE_PAGE_SIZE);
  }, [coveragePage, coverageWindows]);
  const filteredJobs = useMemo(
    () => jobs.jobs.filter((job) => isOverviewJobFilterStatus(job.status) && jobStatusFilters[job.status]),
    [jobStatusFilters, jobs.jobs],
  );
  const detailsStatus = details?.status ?? null;
  const isDetailsLive = detailsStatus ? isLiveOverviewJobStatus(detailsStatus) : false;

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
    setCoveragePage((current) => Math.min(Math.max(1, current), coveragePageCount));
  }, [coveragePageCount]);

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

  const applyRankingFilters = useCallback(
    (nextFilters: OverviewFilters, historyMode: "push" | "replace" = "push") => {
      const normalizedFilters = {
        ...nextFilters,
        domain: nextFilters.domain.trim(),
        client_ip: nextFilters.client_ip.trim(),
      };

      setFilters(normalizedFilters);
      startTransition(() => {
        const href = buildOverviewHref(normalizedFilters, timeZone, "ranking");

        if (historyMode === "replace") {
          router.replace(href);
          return;
        }

        router.push(href);
      });
    },
    [router, timeZone],
  );

  const handleRankingFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyRankingFilters(filters);
  };

  const applyRankingValueFilter = (key: RankingFilterKey, value: string) => {
    applyRankingFilters({
      ...filters,
      [key]: value,
    });
  };

  const clearRankingFilters = () => {
    applyRankingFilters({
      ...filters,
      domain: "",
      client_ip: "",
      groupBy: "hour",
    });
  };

  const updateClientFilter = (value: string) => {
    applyRankingFilters({
      ...filters,
      client_ip: value === CLIENT_FILTER_ALL_VALUE ? "" : value,
    });
  };

  const updateGroupByFilter = (value: string) => {
    const groupBy: OverviewGroupBy = value === "day" ? "day" : "hour";

    applyRankingFilters({
      ...filters,
      groupBy,
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
        const searchParams = new URLSearchParams({
          tab: "ranking",
          from: `${from}`,
          until: `${until}`,
          groupBy: filters.groupBy,
        });
        const domain = filters.domain.trim();
        const clientIp = filters.client_ip.trim();

        if (domain.length > 0) {
          searchParams.set("domain", domain);
        }

        if (clientIp.length > 0) {
          searchParams.set("client_ip", clientIp);
        }

        const href = `/overview?${searchParams.toString()}`;

        if (historyMode === "replace") {
          router.replace(href);
          return;
        }

        router.push(href);
      });
    },
    [filters.client_ip, filters.domain, filters.groupBy, router],
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
    async (jobId: string, options: DetailsLoadOptions = {}) => {
      if (detailsRequestInFlightRef.current === jobId) {
        return;
      }

      const requestToken = detailsRequestTokenRef.current + 1;
      detailsRequestTokenRef.current = requestToken;
      detailsRequestInFlightRef.current = jobId;

      if (!options.silent) {
        setIsDetailsLoading(true);
      }

      try {
        const { data, response } = await client.GET<OverviewJobDetailsResponse>(`/overview/jobs/${jobId}/details`);

        if (!response.ok || !data) {
          if (!options.silent) {
            toast.error(messages.overview.toasts.jobDetailsFailed);
          }
          return;
        }

        if (detailsRequestTokenRef.current !== requestToken) {
          return;
        }

        setDetails(data.job);
        setDetailsLastUpdatedAt(new Date().toISOString());
      } finally {
        if (detailsRequestInFlightRef.current === jobId) {
          detailsRequestInFlightRef.current = null;
        }

        if (detailsRequestTokenRef.current === requestToken && !options.silent) {
          setIsDetailsLoading(false);
        }
      }
    },
    [client, messages],
  );

  const openJobDetails = async (jobId: string) => {
    setDetailsJobId(jobId);
    setDetails(null);
    setDetailsLastUpdatedAt(null);
    await loadJobDetails(jobId);
  };

  const closeJobDetails = () => {
    detailsRequestTokenRef.current += 1;
    setDetailsJobId(null);
    setDetails(null);
    setDetailsLastUpdatedAt(null);
  };

  useEffect(() => {
    if (!detailsJobId || !detailsStatus || !isLiveOverviewJobStatus(detailsStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadJobDetails(detailsJobId, { silent: true });
    }, DETAILS_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [detailsStatus, detailsJobId, loadJobDetails]);

  const toggleJobStatusFilter = (status: OverviewJobFilterStatus) => {
    setJobStatusFilters((current) => ({
      ...current,
      [status]: !current[status],
    }));
  };

  const formatCount = (value: number) => numberFormatter.format(value);
  const formatPercentage = (value: number) => `${percentageFormatter.format(value)}%`;
  const chartTitle =
    overview.charts.queries.groupBy === "day"
      ? messages.overview.chart.titleByDay
      : messages.overview.chart.titleByHour;
  const selectedRankingJobValue = selectedRankingJob?.id;
  const noKpiValue = messages.overview.ranking.kpis.noValue;
  const activeDomainFilter = filters.domain.trim();
  const activeClientFilter = filters.client_ip.trim();
  const hasFocusedRankingContext = activeDomainFilter.length > 0 || activeClientFilter.length > 0;
  const allowedQueries = Math.max(0, overview.summary.totalQueries - overview.summary.blockedQueries);
  const allowedPercentage =
    overview.summary.totalQueries > 0 ? (allowedQueries / overview.summary.totalQueries) * 100 : 0;
  const blockedPercentage = overview.summary.percentageBlocked;
  const rankingContextTitle = hasFocusedRankingContext
    ? messages.overview.ranking.analytics.filteredContextTitle
    : messages.overview.ranking.analytics.contextTitle;
  const rankingContextDescription = messages.overview.ranking.analytics.contextDescription(
    formatDateTime(overview.filters.from),
    formatDateTime(overview.filters.until),
  );
  const totalQueriesPeak = getPeakPoint(overview.charts.queries.points, "totalQueries");
  const blockedQueriesPeak = getPeakPoint(overview.charts.queries.points, "blockedQueries");
  const domainLeader = getRankingLeader(overview.rankings.domains, overview.summary.totalQueries);
  const clientLeader = getRankingLeader(rankingClientRows, overview.summary.totalQueries);
  const upstreamLeader = getRankingLeader(overview.rankings.upstreams, overview.summary.totalQueries);
  const statusLeader = getRankingLeader(overview.rankings.statuses, overview.summary.totalQueries);
  const hourlyAccessPeak = hourlyAccessRows.reduce<HourlyAccessRow | null>((peak, row) => {
    if (!peak || row.totalQueries > peak.totalQueries) {
      return row;
    }

    return peak;
  }, null);

  const formatRankingLeaderDetail = (leader: ReturnType<typeof getRankingLeader>) => {
    if (!leader) {
      return noKpiValue;
    }

    return `${formatCount(leader.count)} ${messages.overview.ranking.queries.toLowerCase()} | ${formatPercentage(
      leader.percentage,
    )}`;
  };

  const rankingKpis: RankingKpiCard[] = [
    {
      label: messages.overview.ranking.kpis.peakQueries,
      value: totalQueriesPeak ? formatCount(totalQueriesPeak.totalQueries) : noKpiValue,
      detail: totalQueriesPeak ? formatDateTime(totalQueriesPeak.timestamp) : messages.overview.chart.noDataTitle,
      Icon: Activity,
      accentClassName: "text-sky-600 dark:text-sky-300",
    },
    {
      label: messages.overview.ranking.kpis.peakBlocked,
      value: blockedQueriesPeak ? formatCount(blockedQueriesPeak.blockedQueries) : noKpiValue,
      detail: blockedQueriesPeak ? formatDateTime(blockedQueriesPeak.timestamp) : messages.overview.chart.noDataTitle,
      Icon: ShieldBan,
      accentClassName: "text-rose-600 dark:text-rose-300",
    },
    {
      label: messages.overview.ranking.kpis.topDomain,
      value: domainLeader?.value ?? noKpiValue,
      detail: formatRankingLeaderDetail(domainLeader),
      Icon: Globe,
      accentClassName: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: messages.overview.ranking.kpis.topClient,
      value: clientLeader?.value ?? noKpiValue,
      detail: formatRankingLeaderDetail(clientLeader),
      Icon: Monitor,
      accentClassName: "text-violet-600 dark:text-violet-300",
    },
    {
      label: messages.overview.ranking.kpis.topUpstream,
      value: upstreamLeader?.value ?? noKpiValue,
      detail: formatRankingLeaderDetail(upstreamLeader),
      Icon: Server,
      accentClassName: "text-amber-600 dark:text-amber-300",
    },
    {
      label: messages.overview.ranking.kpis.topStatus,
      value: statusLeader?.value ?? noKpiValue,
      detail: formatRankingLeaderDetail(statusLeader),
      Icon: CircleGauge,
      accentClassName: "text-cyan-600 dark:text-cyan-300",
    },
  ];

  const getJobExecutionOriginLabel = (job: Pick<OverviewJobsResponse["jobs"][number], "kind" | "trigger">) => {
    if (job.kind === "AUTOMATIC_IMPORT") {
      return messages.overview.jobs.detailsOriginAutomatic;
    }

    return messages.overview.jobs.detailsOriginManual;
  };

  const getRankingJobOptionLabel = (job: OverviewJobsResponse["jobs"][number]) => {
    const instanceLabel =
      job.scope === "instance"
        ? (job.instanceName ?? messages.overview.jobs.detailsUnavailable)
        : messages.overview.jobs.detailsAllInstances;

    return [
      messages.overview.coverage.period(formatDateTime(job.requestedFrom), formatDateTime(job.requestedUntil)),
      instanceLabel,
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

  const getTimelineEventIcon = (level: OverviewJobDetailsResponse["job"]["timeline"][number]["level"]) => {
    switch (level) {
      case "error":
        return ShieldBan;
      case "warn":
        return TriangleAlert;
      default:
        return CheckCircle2;
    }
  };

  const renderRankingKpiCard = (item: RankingKpiCard) => (
    <Card key={item.label} className="overflow-hidden">
      <CardContent className="flex min-h-28 items-start gap-3 p-4">
        <div className={cn("rounded-md border bg-muted/40 p-2", item.accentClassName)}>
          <item.Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs">{item.label}</p>
          <p className="truncate font-semibold text-base tabular-nums">{item.value}</p>
          <p className="truncate text-muted-foreground text-xs">{item.detail}</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderShareLegend = (rows: RankingShareRow[]) => (
    <div className="space-y-2 self-center">
      {rows.map((item) => (
        <div key={item.value} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
            <span className="truncate">{item.value}</span>
          </div>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {formatCount(item.count)} | {formatPercentage(item.percentage)}
          </span>
        </div>
      ))}
    </div>
  );

  const renderDomainShareTable = (rows: RankingShareRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{messages.overview.ranking.analytics.domainColumn}</TableHead>
          <TableHead className="text-right">{messages.overview.ranking.analytics.totalColumn}</TableHead>
          <TableHead className="text-right">{messages.overview.ranking.analytics.percentageColumn}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((item) => {
          const isOtherRow = item.value === messages.overview.ranking.analytics.other;
          const isActiveFilter = filters.domain === item.value;

          return (
            <TableRow key={item.value}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
                  {isOtherRow ? (
                    <span className="truncate">{item.value}</span>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      aria-pressed={isActiveFilter}
                      className={cn(
                        "h-auto min-w-0 justify-start whitespace-normal p-0 text-left font-normal",
                        isActiveFilter ? "font-medium text-foreground" : null,
                      )}
                      onClick={() => applyRankingValueFilter("domain", item.value)}
                    >
                      {item.value}
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCount(item.count)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercentage(item.percentage)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const renderRankingTable = (
    rows: Array<{ value: string; count: number }>,
    title: string,
    filterKey?: RankingFilterKey,
  ) => (
    <div className="space-y-2">
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
            {rows.map((item) => {
              const isActiveFilter = filterKey ? filters[filterKey] === item.value : false;

              return (
                <TableRow key={`${title}-${item.value}`}>
                  <TableCell>
                    {filterKey ? (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        aria-pressed={isActiveFilter}
                        className={cn(
                          "h-auto justify-start whitespace-normal p-0 text-left font-normal",
                          isActiveFilter ? "font-medium text-foreground" : null,
                        )}
                        onClick={() => applyRankingValueFilter(filterKey, item.value)}
                      >
                        {item.value}
                      </Button>
                    ) : (
                      item.value
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(item.count)}</TableCell>
                </TableRow>
              );
            })}
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

              {coverageWindows.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.coverage.completedEmptyTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.coverage.completedEmptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {paginatedCoverageWindows.map((window) => (
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
                  {coveragePageCount > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-muted-foreground text-sm">
                        {messages.overview.coverage.paginationStatus(
                          formatCount(coveragePage),
                          formatCount(coveragePageCount),
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCoveragePage((current) => Math.max(1, current - 1))}
                          disabled={coveragePage <= 1}
                        >
                          <ChevronLeft />
                          {messages.overview.coverage.paginationPrevious}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCoveragePage((current) => Math.min(coveragePageCount, current + 1))}
                          disabled={coveragePage >= coveragePageCount}
                        >
                          {messages.overview.coverage.paginationNext}
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  ) : null}
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

              <form
                className="grid gap-3 border-t pt-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(9rem,0.6fr)_auto]"
                onSubmit={handleRankingFilterSubmit}
              >
                <div className="space-y-1">
                  <label htmlFor="overview-ranking-domain" className="font-medium text-sm">
                    {messages.overview.ranking.domainFilter}
                  </label>
                  <Input
                    id="overview-ranking-domain"
                    value={filters.domain}
                    placeholder={messages.overview.ranking.domainPlaceholder}
                    onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="overview-ranking-client" className="font-medium text-sm">
                    {messages.overview.ranking.clientFilter}
                  </label>
                  <Select value={filters.client_ip || CLIENT_FILTER_ALL_VALUE} onValueChange={updateClientFilter}>
                    <SelectTrigger id="overview-ranking-client" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value={CLIENT_FILTER_ALL_VALUE}>{messages.overview.ranking.allClients}</SelectItem>
                      {rankingClientOptions.map((client) => (
                        <SelectItem key={client.value} value={client.value}>
                          {client.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="overview-ranking-group-by" className="font-medium text-sm">
                    {messages.overview.ranking.groupBy}
                  </label>
                  <Select value={filters.groupBy} onValueChange={updateGroupByFilter}>
                    <SelectTrigger id="overview-ranking-group-by" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="hour">{messages.overview.ranking.groupByValues.hour}</SelectItem>
                      <SelectItem value="day">{messages.overview.ranking.groupByValues.day}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-end gap-2 md:self-end">
                  <Button type="submit" variant="secondary" disabled={isPending}>
                    <Filter />
                    {messages.overview.ranking.applyFilters}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearRankingFilters}
                    disabled={isPending || !hasRankingFilters}
                  >
                    <X />
                    {messages.overview.ranking.clearFilters}
                  </Button>
                </div>
              </form>

              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
                <span className="font-medium text-foreground">
                  {messages.overview.ranking.nativeWindowNoticeTitle}.
                </span>{" "}
                {messages.overview.ranking.nativeWindowNoticeDescription}
              </div>

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

          <Card>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-sm">{rankingContextTitle}</p>
                  <p className="text-muted-foreground text-sm">{rankingContextDescription}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeClientFilter ? (
                    <Badge variant="secondary">
                      {messages.overview.ranking.analytics.clientContext(activeClientFilter)}
                    </Badge>
                  ) : null}
                  {activeDomainFilter ? (
                    <Badge variant="secondary">
                      {messages.overview.ranking.analytics.domainContext(activeDomainFilter)}
                    </Badge>
                  ) : null}
                  <Badge variant="outline">
                    {messages.overview.ranking.analytics.groupContext(
                      messages.overview.ranking.groupByValues[filters.groupBy],
                    )}
                  </Badge>
                </div>
              </div>
              <div className="grid min-w-56 grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground text-xs">{messages.overview.ranking.analytics.allowedQueries}</p>
                  <p className="mt-1 font-semibold text-lg tabular-nums">{formatCount(allowedQueries)}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">{formatPercentage(allowedPercentage)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground text-xs">{messages.overview.ranking.analytics.blockedQueries}</p>
                  <p className="mt-1 font-semibold text-lg tabular-nums">
                    {formatCount(overview.summary.blockedQueries)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">{formatPercentage(blockedPercentage)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {rankingKpis.map(renderRankingKpiCard)}
          </div>

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
                <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                  <BarChart accessibilityLayer data={queryChartPoints} barCategoryGap={10}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value: string) => formatDateTime(value)}
                      minTickGap={24}
                    />
                    <YAxis allowDecimals={false} width={48} />
                    <ChartTooltip
                      content={<ChartTooltipContent labelFormatter={(value) => formatDateTime(String(value))} />}
                    />
                    <Bar dataKey="totalQueries" fill="var(--color-totalQueries)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="blockedQueries" fill="var(--color-blockedQueries)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.analytics.topDomainsShareTitle}</CardTitle>
                <CardDescription>{messages.overview.ranking.analytics.topDomainsShareDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {domainShareRows.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                      <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  renderDomainShareTable(domainShareRows)
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.analytics.topClientsShareTitle}</CardTitle>
                <CardDescription>{messages.overview.ranking.analytics.topClientsShareDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {clientShareRows.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                      <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_1fr]">
                    <ChartContainer config={shareChartConfig} className="aspect-auto h-64 w-full">
                      <BarChart
                        accessibilityLayer
                        data={clientShareRows}
                        layout="vertical"
                        margin={{ left: 4, right: 8 }}
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="value"
                          type="category"
                          tickLine={false}
                          axisLine={false}
                          width={92}
                          tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 14)}...` : value)}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="value" />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {clientShareRows.map((item) => (
                            <Cell key={item.value} fill={item.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                    {renderShareLegend(clientShareRows)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.ranking.analytics.hourlyAccessTitle}</CardTitle>
              <CardDescription>{messages.overview.ranking.analytics.hourlyAccessDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.charts.queries.groupBy !== "hour" ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.ranking.analytics.hourlyAccessTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.ranking.analytics.hourlyAccessUnavailable}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : overview.charts.queries.points.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  {hourlyAccessPeak && hourlyAccessPeak.totalQueries > 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {messages.overview.ranking.analytics.hourlyAccessPeak(
                        hourlyAccessPeak.label,
                        formatCount(hourlyAccessPeak.totalQueries),
                      )}
                    </p>
                  ) : null}
                  <ChartContainer config={hourlyAccessChartConfig} className="aspect-auto h-64 w-full">
                    <BarChart accessibilityLayer data={hourlyAccessRows} barCategoryGap={4}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="allowedQueries" stackId="queries" fill="var(--color-allowedQueries)" />
                      <Bar
                        dataKey="blockedQueries"
                        stackId="queries"
                        fill="var(--color-blockedQueries)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.domains}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderRankingTable(overview.rankings.domains, messages.overview.ranking.domains, "domain")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.overview.ranking.clients}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderRankingTable(rankingClientRows, messages.overview.ranking.clients, "client_ip")}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{messages.overview.ranking.statusDistributionTitle}</CardTitle>
              <CardDescription>{messages.overview.ranking.statusDistributionDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {statusChartRows.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.overview.chart.noDataTitle}</EmptyTitle>
                    <EmptyDescription>{messages.overview.chart.noDataDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-4 md:grid-cols-[minmax(12rem,0.45fr)_1fr]">
                  <ChartContainer config={shareChartConfig} className="mx-auto aspect-square h-56">
                    <PieChart accessibilityLayer>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="value" />} />
                      <Pie
                        data={statusChartRows}
                        dataKey="count"
                        nameKey="value"
                        innerRadius={48}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {statusChartRows.map((item) => (
                          <Cell key={item.value} fill={item.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  {renderShareLegend(statusChartRows)}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button type="button" variant="outline" onClick={() => setShowUpstreams((current) => !current)}>
              <Server />
              {showUpstreams ? messages.overview.ranking.hideUpstreams : messages.overview.ranking.showUpstreams}
            </Button>
            {showUpstreams ? (
              <Card>
                <CardHeader>
                  <CardTitle>{messages.overview.ranking.upstreams}</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderRankingTable(overview.rankings.upstreams, messages.overview.ranking.upstreams)}
                </CardContent>
              </Card>
            ) : null}
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
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ListFilter className="size-4" />
                  {messages.overview.jobs.statusFilterTitle}
                </div>
                {JOB_STATUS_FILTER_VALUES.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={jobStatusFilters[status] ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={jobStatusFilters[status]}
                    onClick={() => toggleJobStatusFilter(status)}
                  >
                    {messages.overview.jobs.statusFilterValues[status]}
                  </Button>
                ))}
              </div>

              {filteredJobs.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {jobs.jobs.length === 0
                        ? messages.overview.jobs.emptyTitle
                        : messages.overview.jobs.filteredEmptyTitle}
                    </EmptyTitle>
                    <EmptyDescription>
                      {jobs.jobs.length === 0
                        ? messages.overview.jobs.emptyDescription
                        : messages.overview.jobs.filteredEmptyDescription}
                    </EmptyDescription>
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
                    {filteredJobs.map((job) => (
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
                              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                                <span>
                                  {messages.overview.jobs.pagesSummary(
                                    formatCount(job.progress.completedPages),
                                    formatCount(job.progress.totalPages),
                                  )}
                                </span>
                                <span className="font-medium text-foreground tabular-nums">
                                  {formatPercentage(getJobProgressPercentage(job))}
                                </span>
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
                            {canDeleteJob(job) ? (
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <Activity className="size-5" />
                {messages.overview.jobs.detailsTitle}
              </DialogTitle>
              {details ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {isDetailsLive ? (
                    <Badge variant="secondary" className="gap-1.5">
                      <RefreshCw className="size-3 animate-spin" />
                      {messages.overview.jobs.detailsLive}
                    </Badge>
                  ) : null}
                  {detailsLastUpdatedAt ? (
                    <Badge variant="outline" className="gap-1.5">
                      <Clock3 className="size-3" />
                      {messages.overview.jobs.detailsUpdatedAt(formatFullDateTime(detailsLastUpdatedAt))}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
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
                <TabsTrigger value="summary">
                  <Info />
                  {messages.overview.jobs.detailsTabSummary}
                </TabsTrigger>
                <TabsTrigger value="instances">
                  <Server />
                  {messages.overview.jobs.detailsTabInstances}
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock3 />
                  {messages.overview.jobs.detailsTabTimeline}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-0 min-h-0 flex-1 overflow-hidden outline-none">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-1">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Activity className="size-3.5" />
                          {messages.overview.jobs.status}
                        </p>
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
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Server className="size-3.5" />
                          {messages.overview.jobs.detailsScope}
                        </p>
                        <p className="mt-2 font-semibold">
                          {details.scope === "instance"
                            ? details.instanceName
                            : messages.overview.jobs.detailsAllInstances}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Calendar className="size-3.5" />
                          {messages.overview.jobs.detailsPeriodLabel}
                        </p>
                        <p className="mt-2 font-semibold text-xs">{formatDateTime(details.requestedFrom)}</p>
                        <p className="text-muted-foreground text-xs">{formatDateTime(details.requestedUntil)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <FileText className="size-3.5" />
                          {messages.overview.jobs.detailsOrigin}
                        </p>
                        <p className="mt-2 font-semibold">{getJobExecutionOriginLabel(details)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Database className="size-3.5" />
                          {messages.overview.jobs.detailsRecordsFiltered}
                        </p>
                        <p className="mt-2 font-semibold tabular-nums">
                          {formatCount(details.progress.totalExpectedRecords)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <FileText className="size-3.5" />
                          {messages.overview.jobs.detailsTotalPages}
                        </p>
                        <p className="mt-2 font-semibold tabular-nums">{formatCount(details.progress.totalPages)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Database className="size-3.5" />
                          {messages.overview.jobs.detailsSaved}
                        </p>
                        <p className="mt-2 font-semibold tabular-nums">
                          {formatCount(details.progress.totalInsertedRecords)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <RefreshCw className="size-3.5" />
                          {messages.overview.jobs.detailsAttempts}
                        </p>
                        <p className="mt-2 font-semibold tabular-nums">{formatCount(details.progress.attempts)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      {details.kind !== "MANUAL_DELETE" ? (
                        <Card>
                          <CardContent className="space-y-3 pt-6">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="flex items-center gap-1.5 font-medium text-sm">
                                  <Activity className="size-4" />
                                  {messages.overview.jobs.detailsProgressTitle}
                                </p>
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
                            <p className="flex items-center gap-1.5 font-medium text-sm">
                              <Activity className="size-4" />
                              {messages.overview.jobs.detailsProgressTitle}
                            </p>
                            <p className="font-semibold tabular-nums">{formatCount(details.deletedCount)}</p>
                            <p className="text-muted-foreground text-xs">{getJobStatusSummary(details)}</p>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Clock3 className="size-4" />
                            {messages.overview.jobs.detailsExecutionTitle}
                          </CardTitle>
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
                        <AlertTitle className="flex items-center gap-2">
                          <TriangleAlert className="size-4" />
                          {messages.overview.jobs.detailsFailureTitle}
                        </AlertTitle>
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
                          <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle2 className="size-4" />
                            {messages.overview.jobs.detailsLastSuccessTitle}
                          </CardTitle>
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
                          <CardTitle className="flex items-center gap-2 text-base">
                            <TriangleAlert className="size-4" />
                            {messages.overview.jobs.detailsStalledTitle}
                          </CardTitle>
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
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Database className="size-4" />
                          {messages.overview.jobs.detailsCheckpointTitle}
                        </CardTitle>
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
                            <p className="flex items-center gap-2 font-medium">
                              <Server className="size-4 text-muted-foreground" />
                              {item.instanceName}
                            </p>
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
                      {[...details.timeline]
                        .reverse()
                        .map((event: OverviewJobDetailsResponse["job"]["timeline"][number], index: number) => {
                          const EventIcon = getTimelineEventIcon(event.level);

                          return (
                            <div key={`${event.at}-${index}`} className="rounded-lg border p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <EventIcon className="size-4 text-muted-foreground" />
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
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <Clock3 className="size-3" />
                                  {formatFullDateTime(event.at)}
                                </span>
                              </div>
                              <p className="mt-2">{event.message}</p>
                              {event.instanceName || event.page || event.start !== null ? (
                                <p className="mt-2 text-muted-foreground text-xs">
                                  {[
                                    event.instanceName
                                      ? `${messages.overview.jobs.detailsCheckpointInstance}: ${event.instanceName}`
                                      : null,
                                    event.page
                                      ? `${messages.overview.jobs.detailsCheckpointPage}: ${event.page}`
                                      : null,
                                    event.start !== null
                                      ? `${messages.overview.jobs.detailsCheckpointStart}: ${formatCount(event.start)}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" | ")}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
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
