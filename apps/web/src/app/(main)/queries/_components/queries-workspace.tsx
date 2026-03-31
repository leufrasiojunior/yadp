"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { LucideIcon } from "lucide-react";
import { Ban, ChevronDown, Clock3, Database, Globe, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { QueriesResponse, QuerySuggestionsResponse } from "@/lib/api/yapd-types";
import type { DashboardScope } from "@/lib/dashboard/dashboard-scope";
import { useWebI18n } from "@/lib/i18n/client";
import type { WebMessages } from "@/lib/i18n/messages";
import {
  clampQueryLength,
  createDefaultQueryFilters,
  DEFAULT_QUERIES_LENGTH,
  datetimeLocalToUnixSeconds,
  normalizeQueryPageSize,
  QUERY_PAGE_SIZE_OPTIONS,
  type QueryFilters,
  trimOrEmpty,
} from "@/lib/queries/queries-filters";
import { QUERIES_LIVE_UPDATE_INTERVAL_MS } from "@/lib/queries/queries-refresh";
import { cn } from "@/lib/utils";

const EMPTY_SUGGESTIONS: QuerySuggestionsResponse["suggestions"] = {
  domain: [],
  client_ip: [],
  client_name: [],
  upstream: [],
  type: [],
  status: [],
  reply: [],
  dnssec: [],
};
const QUERY_TABLE_HEADER_SKELETON_KEYS = Array.from({ length: 6 }, (_value, index) => `query-header-${index}`);
const QUERY_TABLE_ROW_SKELETON_KEYS = Array.from({ length: 12 }, (_value, index) => `query-row-${index}`);
const QUERY_TABLE_COLUMN_SKELETON_KEYS = Array.from({ length: 6 }, (_value, index) => `query-column-${index}`);
const FILTER_SUGGESTION_SKELETON_KEYS = Array.from({ length: 7 }, (_value, index) => `query-filter-${index}`);
const EMPTY_SELECT_VALUE = "__any__";

function buildRowKey(query: QueriesResponse["queries"][number]) {
  return `${query.instanceId}:${query.id}`;
}

function getClientLabel(query: QueriesResponse["queries"][number], fallback: string) {
  return query.client?.name ?? query.client?.ip ?? fallback;
}

function normalizeStatus(status: string | null) {
  return status?.trim().toUpperCase() ?? "";
}

function getRowTintClass(status: string | null, index: number) {
  const even = index % 2 === 0;

  switch (normalizeStatus(status)) {
    case "CACHE":
      return even ? "bg-emerald-500/5 hover:bg-emerald-500/9" : "bg-emerald-500/7 hover:bg-emerald-500/11";
    case "FORWARDED":
      return even ? "bg-emerald-500/8 hover:bg-emerald-500/12" : "bg-emerald-500/10 hover:bg-emerald-500/14";
    case "CACHE_STALE":
      return even ? "bg-emerald-500/12 hover:bg-emerald-500/16" : "bg-emerald-500/14 hover:bg-emerald-500/18";
    case "GRAVITY":
      return even ? "bg-red-500/7 hover:bg-red-500/11" : "bg-red-500/9 hover:bg-red-500/13";
    default:
      return "";
  }
}

function formatFullDateTime(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function buildVisiblePages(totalPages: number, currentPage: number) {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_value, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);

  if (currentPage <= 2) {
    pages.add(2);
    pages.add(3);
  } else if (currentPage >= totalPages - 1) {
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  } else {
    pages.add(currentPage);
    pages.add(currentPage + 1);
  }

  return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right);
}

function QueriesTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr] gap-2">
        {QUERY_TABLE_HEADER_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-4 w-full" />
        ))}
      </div>
      {QUERY_TABLE_ROW_SKELETON_KEYS.map((rowKey) => (
        <div key={rowKey} className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr] gap-2">
          {QUERY_TABLE_COLUMN_SKELETON_KEYS.map((columnKey) => (
            <Skeleton key={`${rowKey}-${columnKey}`} className="h-11 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

type SuggestionInputProps = {
  inputId: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
  value: string;
};

type SuggestionSelectInputProps = {
  inputId: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  value: string;
};

type StatusVisual = {
  Icon: LucideIcon;
  iconClassName: string;
  tooltip: string;
};

function SuggestionInput({
  inputId,
  label,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<SuggestionInputProps>) {
  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={inputId}
          list={`${inputId}-list`}
          value={value}
          className="appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 size-4 text-muted-foreground" />
      </div>
      <datalist id={`${inputId}-list`}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}

function SuggestionSelectInput({
  inputId,
  label,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<SuggestionSelectInputProps>) {
  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor={inputId}>
        {label}
      </label>
      <Select
        value={value || EMPTY_SELECT_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
      >
        <SelectTrigger id={inputId} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem>
          {suggestions.map((suggestion) => (
            <SelectItem key={suggestion} value={suggestion}>
              {suggestion}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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

function QueryStatusCell({
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

export function QueriesWorkspace({
  initialData,
  scope,
}: Readonly<{
  initialData: QueriesResponse;
  scope: DashboardScope;
}>) {
  const client = useMemo(() => getBrowserApiClient(), []);
  const { messages, timeZone } = useWebI18n();
  const datalistPrefix = useId();
  const liveToggleId = `${datalistPrefix}-live-toggle`;
  const currentDataRef = useRef(initialData);
  const refreshInFlightRef = useRef(false);
  const activeFiltersRef = useRef<QueryFilters>(createDefaultQueryFilters());
  const refreshQueriesRef = useRef<
    | ((
        filters: QueryFilters,
        options?: { preserveTable?: boolean; silent?: boolean; highlightNew?: boolean },
      ) => Promise<void>)
    | null
  >(null);
  const mountedRef = useRef(true);
  const newRowsTimeoutRef = useRef<number | null>(null);
  const [queryData, setQueryData] = useState(initialData);
  const [draftFilters, setDraftFilters] = useState<QueryFilters>(createDefaultQueryFilters());
  const [activeFilters, setActiveFilters] = useState<QueryFilters>(createDefaultQueryFilters());
  const [suggestions, setSuggestions] = useState<QuerySuggestionsResponse["suggestions"]>(EMPTY_SUGGESTIONS);
  const [isReloading, setIsReloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isLiveEnabled, setIsLiveEnabled] = useState(false);
  const [tableDomainFilter, setTableDomainFilter] = useState("");
  const [tableClientFilter, setTableClientFilter] = useState("");
  const [newRowKeys, setNewRowKeys] = useState<string[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (newRowsTimeoutRef.current !== null) {
        window.clearTimeout(newRowsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    activeFiltersRef.current = activeFilters;
  }, [activeFilters]);

  useEffect(() => {
    if (activeFilters.disk) {
      setIsLiveEnabled(false);
    }
  }, [activeFilters.disk]);

  useEffect(() => {
    let cancelled = false;
    let retryTimeoutId: number | null = null;

    const debounceTimeoutId = window.setTimeout(() => {
      const applyQuickFilters = () => {
        if (cancelled) {
          return;
        }

        if (refreshInFlightRef.current) {
          retryTimeoutId = window.setTimeout(applyQuickFilters, 100);
          return;
        }

        const nextDomain = trimOrEmpty(tableDomainFilter);
        const nextClientIp = trimOrEmpty(tableClientFilter);
        const currentFilters = activeFiltersRef.current;

        if (nextDomain === currentFilters.domain && nextClientIp === currentFilters.clientIp) {
          return;
        }

        const nextFilters = {
          ...currentFilters,
          domain: nextDomain,
          clientIp: nextClientIp,
          start: 0,
        } satisfies QueryFilters;

        setDraftFilters((currentDraft) => ({
          ...currentDraft,
          domain: nextDomain,
          clientIp: nextClientIp,
          start: 0,
        }));
        setActiveFilters(nextFilters);
        setNewRowKeys([]);
        void refreshQueriesRef.current?.(nextFilters, { preserveTable: true });
      };

      applyQuickFilters();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimeoutId);

      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [tableClientFilter, tableDomainFilter]);

  useEffect(() => {
    setQueryData(initialData);
  }, [initialData]);

  useEffect(() => {
    currentDataRef.current = queryData;
  }, [queryData]);

  useEffect(() => {
    let active = true;

    async function loadSuggestions() {
      setIsSuggestionsLoading(true);
      const { data, response } = await client.GET<QuerySuggestionsResponse>("/queries/suggestions", {
        params: {
          query:
            scope.kind === "all"
              ? {
                  scope: "all",
                }
              : {
                  scope: "instance",
                  instanceId: scope.instanceId,
                },
        },
      });

      if (!active || !mountedRef.current) {
        return;
      }

      if (response.ok && data) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions(EMPTY_SUGGESTIONS);
      }

      setIsSuggestionsLoading(false);
    }

    void loadSuggestions();

    return () => {
      active = false;
    };
  }, [client, scope]);

  async function refreshQueries(
    filters: QueryFilters,
    options?: { preserveTable?: boolean; silent?: boolean; highlightNew?: boolean },
  ) {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (options?.silent || options?.preserveTable) {
      setIsRefreshing(true);
    } else {
      setIsReloading(true);
    }

    try {
      const { data, response } = await client.GET<QueriesResponse>("/queries", {
        params: {
          query: {
            scope: scope.kind === "all" ? "all" : "instance",
            ...(scope.kind === "instance" ? { instanceId: scope.instanceId } : {}),
            ...(datetimeLocalToUnixSeconds(filters.from) !== undefined
              ? {
                  from: datetimeLocalToUnixSeconds(filters.from),
                }
              : {}),
            ...(datetimeLocalToUnixSeconds(filters.until) !== undefined
              ? {
                  until: datetimeLocalToUnixSeconds(filters.until),
                }
              : {}),
            length: clampQueryLength(filters.length),
            start: Math.max(0, filters.start),
            ...(trimOrEmpty(filters.domain) ? { domain: trimOrEmpty(filters.domain) } : {}),
            ...(trimOrEmpty(filters.clientIp) ? { client_ip: trimOrEmpty(filters.clientIp) } : {}),
            ...(trimOrEmpty(filters.upstream) ? { upstream: trimOrEmpty(filters.upstream) } : {}),
            ...(trimOrEmpty(filters.type) ? { type: trimOrEmpty(filters.type) } : {}),
            ...(trimOrEmpty(filters.status) ? { status: trimOrEmpty(filters.status) } : {}),
            ...(trimOrEmpty(filters.reply) ? { reply: trimOrEmpty(filters.reply) } : {}),
            ...(trimOrEmpty(filters.dnssec) ? { dnssec: trimOrEmpty(filters.dnssec) } : {}),
            ...(filters.disk ? { disk: true } : {}),
          },
        },
      });

      if (!mountedRef.current || !response.ok || !data) {
        return;
      }

      if (options?.highlightNew && filters.start === 0) {
        const currentKeys = new Set(currentDataRef.current.queries.map(buildRowKey));
        const insertedKeys = data.queries.map(buildRowKey).filter((key) => !currentKeys.has(key));

        if (insertedKeys.length > 0) {
          setNewRowKeys(insertedKeys);

          if (newRowsTimeoutRef.current !== null) {
            window.clearTimeout(newRowsTimeoutRef.current);
          }

          newRowsTimeoutRef.current = window.setTimeout(() => {
            setNewRowKeys([]);
          }, 1_400);
        }
      }

      setQueryData(data);
    } finally {
      if (mountedRef.current) {
        setIsReloading(false);
        setIsRefreshing(false);
      }

      refreshInFlightRef.current = false;
    }
  }

  refreshQueriesRef.current = refreshQueries;

  useEffect(() => {
    if (!isLiveEnabled) {
      setIsRefreshing(false);
      return;
    }

    if (document.visibilityState === "visible") {
      void refreshQueriesRef.current?.(activeFiltersRef.current, {
        silent: true,
        highlightNew: true,
      });
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshQueriesRef.current?.(activeFiltersRef.current, {
        silent: true,
        highlightNew: true,
      });
    }, QUERIES_LIVE_UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLiveEnabled]);

  const hasRows = queryData.queries.length > 0;
  const visibleStart = hasRows ? activeFilters.start + 1 : 0;
  const visibleEnd = activeFilters.start + queryData.queries.length;
  const canGoPrevious = activeFilters.start > 0;
  const canGoNext = activeFilters.start + activeFilters.length < queryData.recordsFiltered;
  const currentPage = Math.floor(activeFilters.start / activeFilters.length) + 1;
  const totalPages = Math.max(1, Math.ceil(queryData.recordsFiltered / activeFilters.length));
  const visiblePages = buildVisiblePages(totalPages, currentPage);
  const responsiveSummary = messages.queries.responsiveInstances(
    queryData.sources.successfulInstances.length,
    queryData.sources.totalInstances,
  );

  function updateDraft<K extends keyof QueryFilters>(key: K, value: QueryFilters[K]) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    const nextFilters = {
      ...draftFilters,
      length: clampQueryLength(draftFilters.length),
      start: 0,
    } satisfies QueryFilters;

    setTableDomainFilter(nextFilters.domain);
    setTableClientFilter(nextFilters.clientIp);
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    setNewRowKeys([]);
    void refreshQueries(nextFilters);
  }

  function clearFilters() {
    const nextFilters = createDefaultQueryFilters();

    setTableDomainFilter("");
    setTableClientFilter("");
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    setNewRowKeys([]);
    void refreshQueries(nextFilters);
  }

  function goToPage(start: number) {
    const nextFilters = {
      ...activeFilters,
      start: Math.max(0, start),
    } satisfies QueryFilters;

    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    setNewRowKeys([]);
    void refreshQueries(nextFilters, { preserveTable: true });
  }

  function changePageSize(nextLength: number) {
    const normalizedLength = normalizeQueryPageSize(nextLength);
    const nextFilters = {
      ...activeFilters,
      length: normalizedLength,
      start: 0,
    } satisfies QueryFilters;

    setDraftFilters((currentDraft) => ({
      ...currentDraft,
      length: normalizedLength,
      start: 0,
    }));
    setActiveFilters(nextFilters);
    setNewRowKeys([]);
    void refreshQueries(nextFilters, { preserveTable: true });
  }

  return (
    <div className="space-y-6">
      <Card className="transition-colors hover:bg-muted/20">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader
            className="flex cursor-pointer flex-row items-start justify-between gap-4"
            onClick={() => setIsFiltersOpen((current) => !current)}
          >
            <div className="space-y-1">
              <CardTitle>{messages.queries.filters.title}</CardTitle>
              <CardDescription>{messages.queries.filters.description}</CardDescription>
              <p className="text-muted-foreground text-xs">{responsiveSummary}</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" onClick={(event) => event.stopPropagation()}>
                {isFiltersOpen ? messages.queries.filters.hide : messages.queries.filters.show}
                <ChevronDown className={cn("size-4 transition-transform", isFiltersOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFilters();
                }}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="font-medium text-sm" htmlFor={`${datalistPrefix}-from`}>
                      {messages.queries.filters.from}
                    </label>
                    <Input
                      id={`${datalistPrefix}-from`}
                      type="datetime-local"
                      value={draftFilters.from}
                      onChange={(event) => updateDraft("from", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-medium text-sm" htmlFor={`${datalistPrefix}-until`}>
                      {messages.queries.filters.until}
                    </label>
                    <Input
                      id={`${datalistPrefix}-until`}
                      type="datetime-local"
                      value={draftFilters.until}
                      onChange={(event) => updateDraft("until", event.target.value)}
                    />
                  </div>

                  {isSuggestionsLoading ? (
                    FILTER_SUGGESTION_SKELETON_KEYS.map((key) => (
                      <Skeleton key={key} className="h-[68px] w-full rounded-xl" />
                    ))
                  ) : (
                    <>
                      <SuggestionInput
                        inputId={`${datalistPrefix}-domain`}
                        label={messages.queries.filters.domain}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.domain}
                        value={draftFilters.domain}
                        onChange={(value) => updateDraft("domain", value)}
                      />
                      <SuggestionInput
                        inputId={`${datalistPrefix}-client-ip`}
                        label={messages.queries.filters.clientIp}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.client_ip}
                        value={draftFilters.clientIp}
                        onChange={(value) => updateDraft("clientIp", value)}
                      />
                      <SuggestionInput
                        inputId={`${datalistPrefix}-upstream`}
                        label={messages.queries.filters.upstream}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.upstream}
                        value={draftFilters.upstream}
                        onChange={(value) => updateDraft("upstream", value)}
                      />
                      <SuggestionSelectInput
                        inputId={`${datalistPrefix}-type`}
                        label={messages.queries.filters.type}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.type}
                        value={draftFilters.type}
                        onChange={(value) => updateDraft("type", value)}
                      />
                      <SuggestionSelectInput
                        inputId={`${datalistPrefix}-status`}
                        label={messages.queries.filters.status}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.status}
                        value={draftFilters.status}
                        onChange={(value) => updateDraft("status", value)}
                      />
                      <SuggestionSelectInput
                        inputId={`${datalistPrefix}-reply`}
                        label={messages.queries.filters.reply}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.reply}
                        value={draftFilters.reply}
                        onChange={(value) => updateDraft("reply", value)}
                      />
                      <SuggestionSelectInput
                        inputId={`${datalistPrefix}-dnssec`}
                        label={messages.queries.filters.dnssec}
                        placeholder={messages.queries.filters.suggestionPlaceholder}
                        suggestions={suggestions.dnssec}
                        value={draftFilters.dnssec}
                        onChange={(value) => updateDraft("dnssec", value)}
                      />
                      <div className="md:col-span-2 xl:col-span-4">
                        <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{messages.queries.filters.disk}</p>
                            <p className="text-muted-foreground text-xs">{messages.queries.filters.diskDescription}</p>
                          </div>
                          <Switch
                            checked={draftFilters.disk}
                            onCheckedChange={(checked) => {
                              const nextValue = Boolean(checked);

                              updateDraft("disk", nextValue);

                              if (nextValue) {
                                setIsLiveEnabled(false);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isReloading}>
                    {isReloading ? messages.queries.filters.applying : messages.queries.filters.apply}
                  </Button>
                  <Button type="button" variant="outline" disabled={isReloading} onClick={clearFilters}>
                    {messages.queries.filters.clear}
                  </Button>
                  {isSuggestionsLoading ? (
                    <span className="text-muted-foreground text-xs">{messages.queries.filters.suggestionsLoading}</span>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{messages.queries.table.title}</CardTitle>
            <CardDescription className="mt-1">{messages.queries.table.description}</CardDescription>
          </div>
          <CardAction>
            <label htmlFor={liveToggleId} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Checkbox
                id={liveToggleId}
                checked={isLiveEnabled}
                disabled={draftFilters.disk || activeFilters.disk}
                onCheckedChange={(checked) => setIsLiveEnabled(checked === true)}
              />
              <span className="font-medium">{messages.queries.table.liveToggle}</span>
              {isRefreshing ? (
                <span className="text-muted-foreground text-xs">{messages.queries.table.refreshing}</span>
              ) : null}
            </label>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReloading ? (
            <QueriesTableSkeleton />
          ) : hasRows ? (
            <>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r text-center">{messages.queries.table.time}</TableHead>
                      <TableHead className="border-r text-center">{messages.queries.table.instance}</TableHead>
                      <TableHead className="w-14 border-r text-center">
                        <span className="sr-only">{messages.queries.table.status}</span>
                      </TableHead>
                      <TableHead className="border-r text-center">{messages.queries.table.type}</TableHead>
                      <TableHead className="border-r text-center">{messages.queries.table.domain}</TableHead>
                      <TableHead className="text-center">{messages.queries.table.client}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryData.queries.map((query, index) => (
                      <TableRow
                        key={buildRowKey(query)}
                        className={cn(
                          getRowTintClass(query.status, index),
                          newRowKeys.includes(buildRowKey(query)) &&
                            "fade-in-0 slide-in-from-top-2 animate-in duration-300",
                        )}
                      >
                        <TableCell className="border-r text-center text-xs tabular-nums">
                          {formatFullDateTime(query.time, timeZone)}
                        </TableCell>
                        <TableCell className="max-w-56 truncate border-r text-center font-medium">
                          {query.instanceName}
                        </TableCell>
                        <TableCell className="border-r text-center">
                          <QueryStatusCell messages={messages} status={query.status} />
                        </TableCell>
                        <TableCell className="border-r text-center">
                          {query.type ?? messages.common.versionUnavailable}
                        </TableCell>
                        <TableCell className="max-w-96 truncate border-r text-center">
                          {query.domain ?? messages.common.versionUnavailable}
                        </TableCell>
                        <TableCell className="max-w-72 truncate text-center">
                          {getClientLabel(query, messages.common.versionUnavailable)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-background font-normal">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="border-r" />
                      <TableCell className="border-r" />
                      <TableCell className="border-r" />
                      <TableCell className="border-r" />
                      <TableCell className="border-r p-1.5">
                        <Input
                          value={tableDomainFilter}
                          placeholder={messages.queries.table.domain}
                          className="text-center"
                          onChange={(event) => setTableDomainFilter(event.target.value)}
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={tableClientFilter}
                          placeholder={messages.queries.table.client}
                          className="text-center"
                          onChange={(event) => setTableClientFilter(event.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground">
                  {messages.queries.table.showing(visibleStart, visibleEnd, queryData.recordsFiltered)}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isLiveEnabled ? (
                    <span className="text-muted-foreground text-xs">
                      {messages.queries.table.liveNavigationWarning}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{messages.queries.table.rowsPerPage}</span>
                    <Select
                      value={`${normalizeQueryPageSize(activeFilters.length)}`}
                      onValueChange={(value) => changePageSize(Number(value) || DEFAULT_QUERIES_LENGTH)}
                    >
                      <SelectTrigger className="w-[96px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUERY_PAGE_SIZE_OPTIONS.map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    disabled={isLiveEnabled || !canGoPrevious || isReloading}
                    onClick={() => goToPage(activeFilters.start - activeFilters.length)}
                  >
                    {messages.queries.table.previous}
                  </Button>
                  {visiblePages.map((page, index) => {
                    const previousPage = visiblePages[index - 1];
                    const shouldShowGap = previousPage !== undefined && page - previousPage > 1;

                    return (
                      <div key={`page-slot-${page}`} className="flex items-center gap-2">
                        {shouldShowGap ? <span className="px-1 text-muted-foreground">...</span> : null}
                        <Button
                          variant={page === currentPage ? "default" : "outline"}
                          disabled={isLiveEnabled || isReloading || page === currentPage}
                          aria-current={page === currentPage ? "page" : undefined}
                          onClick={() => goToPage((page - 1) * activeFilters.length)}
                        >
                          {page}
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    disabled={isLiveEnabled || !canGoNext || isReloading}
                    onClick={() => goToPage(activeFilters.start + activeFilters.length)}
                  >
                    {messages.queries.table.next}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database />
                </EmptyMedia>
                <EmptyTitle>{messages.queries.table.noResultsTitle}</EmptyTitle>
                <EmptyDescription>{messages.queries.table.noResultsDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
