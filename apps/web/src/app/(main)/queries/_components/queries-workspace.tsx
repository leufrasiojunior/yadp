"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { DomainOperationResponse, QueriesResponse, QuerySuggestionsResponse } from "@/lib/api/yapd-types";
import type { DashboardScope } from "@/lib/dashboard/dashboard-scope";
import { useWebI18n } from "@/lib/i18n/client";
import {
  clampQueryLength,
  createDefaultQueryFilters,
  DEFAULT_QUERIES_LENGTH,
  datetimeLocalToUnixSeconds,
  normalizeQueryPageSize,
  type QueryFilters,
  trimOrEmpty,
} from "@/lib/queries/queries-filters";
import { QUERIES_LIVE_UPDATE_INTERVAL_MS } from "@/lib/queries/queries-refresh";

import { QueriesFiltersCard } from "./queries-filters-card";
import { QueriesTableCard } from "./queries-table-card";

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

type DomainActionType = DomainOperationResponse["request"]["type"];
type DomainActionKind = DomainOperationResponse["request"]["kind"];

function buildRowKey(query: QueriesResponse["queries"][number]) {
  return `${query.instanceId}:${query.id}`;
}

export function QueriesWorkspace({
  initialData,
  scope,
}: Readonly<{
  initialData: QueriesResponse;
  scope: DashboardScope;
}>) {
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const { messages, timeZone } = useWebI18n();
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
  const [pendingDomainActionKeys, setPendingDomainActionKeys] = useState<string[]>([]);
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

  function buildDomainActionKey(
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) {
    return `${buildRowKey(query)}:${type}:${kind}`;
  }

  function isDomainActionPending(
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) {
    return pendingDomainActionKeys.includes(buildDomainActionKey(query, type, kind));
  }

  function isAnyDomainActionPending(query: QueriesResponse["queries"][number]) {
    const prefix = `${buildRowKey(query)}:`;
    return pendingDomainActionKeys.some((key) => key.startsWith(prefix));
  }

  async function submitDomainAction(
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
    retryInstanceId?: string,
  ) {
    const domain = trimOrEmpty(query.domain ?? "");

    if (!domain) {
      return;
    }

    const actionKey = buildDomainActionKey(query, type, kind);
    const actionLabel =
      type === "allow"
        ? messages.queries.actions.allow
        : kind === "regex"
          ? messages.queries.actions.blockRegex
          : messages.queries.actions.blockDomain;
    const scopeMode: DomainOperationResponse["request"]["scope"] = retryInstanceId
      ? "instance"
      : type === "deny" && kind === "exact"
        ? "all"
        : scope.kind === "all"
          ? "all"
          : "instance";
    const instanceId =
      retryInstanceId ?? (scopeMode === "instance" && scope.kind === "instance" ? scope.instanceId : undefined);

    setPendingDomainActionKeys((current) => (current.includes(actionKey) ? current : [...current, actionKey]));

    try {
      const { data, response } = await client.POST<DomainOperationResponse>("/domains/{type}/{kind}", {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        params: {
          path: {
            type,
            kind,
          },
        },
        body: {
          domain,
          scope: scopeMode,
          ...(instanceId ? { instanceId } : {}),
        },
      });

      if (!response.ok || !data) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      if (data.summary.failedCount === 0 && data.summary.successfulCount > 0) {
        toast.success(messages.queries.toasts.actionSuccess(actionLabel, data.summary.successfulCount));
      } else if (data.summary.successfulCount > 0 && data.summary.failedCount > 0) {
        toast.warning(
          messages.queries.toasts.actionPartial(actionLabel, data.summary.successfulCount, data.summary.failedCount),
        );
      }

      data.failedInstances.forEach((failure) => {
        const message =
          failure.message.trim().length > 0
            ? messages.queries.toasts.instanceFailure(failure.instanceName, failure.message)
            : messages.queries.toasts.genericInstanceFailure(failure.instanceName);

        toast.error(message, {
          id: `query-domain-action-${type}-${kind}-${failure.instanceId}-${domain}`,
          action: {
            label: messages.common.retry,
            onClick: () => {
              void submitDomainAction(query, type, kind, failure.instanceId);
            },
          },
        });
      });
    } finally {
      setPendingDomainActionKeys((current) => current.filter((key) => key !== actionKey));
    }
  }

  return (
    <div className="space-y-6">
      <QueriesFiltersCard
        applyFilters={applyFilters}
        clearFilters={clearFilters}
        draftFilters={draftFilters}
        isFiltersOpen={isFiltersOpen}
        isReloading={isReloading}
        isSuggestionsLoading={isSuggestionsLoading}
        messages={messages}
        responsiveSummary={responsiveSummary}
        setIsFiltersOpen={setIsFiltersOpen}
        setIsLiveEnabled={setIsLiveEnabled}
        suggestions={suggestions}
        updateDraft={updateDraft}
      />

      <QueriesTableCard
        activeFilters={activeFilters}
        changePageSize={changePageSize}
        goToPage={goToPage}
        isAnyDomainActionPending={isAnyDomainActionPending}
        isDomainActionPending={isDomainActionPending}
        isLiveEnabled={isLiveEnabled}
        isRefreshing={isRefreshing}
        isReloading={isReloading}
        messages={messages}
        newRowKeys={newRowKeys}
        queryData={queryData}
        setIsLiveEnabled={setIsLiveEnabled}
        setTableClientFilter={setTableClientFilter}
        setTableDomainFilter={setTableDomainFilter}
        submitDomainAction={submitDomainAction}
        tableClientFilter={tableClientFilter}
        tableDomainFilter={tableDomainFilter}
        timeZone={timeZone}
      />
    </div>
  );
}
