"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  DomainOperationResponse,
  QueriesResponse,
  QueryGroupMembershipRefreshResponse,
  QuerySuggestionsResponse,
} from "@/lib/api/yapd-types";
import type { DashboardScope } from "@/lib/dashboard/dashboard-scope";
import { useWebI18n } from "@/lib/i18n/client";
import {
  clampQueryLength,
  createDefaultQueryFilters,
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
const QUERY_GROUP_REVIEW_FINGERPRINT_STORAGE_KEY = "yapd.queries.groupReviewFingerprint";

type DomainActionType = DomainOperationResponse["request"]["type"];
type DomainActionKind = DomainOperationResponse["request"]["kind"];

function buildRowKey(query: QueriesResponse["queries"][number]) {
  return `${query.instanceId}:${query.id}`;
}

function normalizeQueriesResponse(data: QueriesResponse, filters: Pick<QueryFilters, "length">): QueriesResponse {
  const pageSize = clampQueryLength(filters.length);
  const uniqueQueries: QueriesResponse["queries"] = [];
  const seenKeys = new Set<string>();

  for (const query of data.queries) {
    const key = buildRowKey(query);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueQueries.push(query);

    if (uniqueQueries.length >= pageSize) {
      break;
    }
  }

  if (uniqueQueries.length === data.queries.length) {
    return data;
  }

  return {
    ...data,
    queries: uniqueQueries,
  };
}

export function QueriesWorkspace({
  initialData,
  scope,
}: Readonly<{
  initialData: QueriesResponse;
  scope: DashboardScope;
}>) {
  const defaultFilters = createDefaultQueryFilters();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const { messages, timeZone } = useWebI18n();
  const currentDataRef = useRef(normalizeQueriesResponse(initialData, defaultFilters));
  const refreshInFlightRef = useRef(false);
  const activeFiltersRef = useRef<QueryFilters>(defaultFilters);
  const refreshQueriesRef = useRef<
    | ((
        filters: QueryFilters,
        options?: { preserveTable?: boolean; silent?: boolean; highlightNew?: boolean },
      ) => Promise<void>)
    | null
  >(null);
  const mountedRef = useRef(true);
  const newRowsTimeoutRef = useRef<number | null>(null);
  const [queryData, setQueryData] = useState(() => normalizeQueriesResponse(initialData, defaultFilters));
  const [draftFilters, setDraftFilters] = useState<QueryFilters>(defaultFilters);
  const [activeFilters, setActiveFilters] = useState<QueryFilters>(defaultFilters);
  const [suggestions, setSuggestions] = useState<QuerySuggestionsResponse["suggestions"]>(EMPTY_SUGGESTIONS);
  const [groupOptions, setGroupOptions] = useState<QuerySuggestionsResponse["groupOptions"]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isLiveEnabled, setIsLiveEnabled] = useState(false);
  const [pendingDomainActionKeys, setPendingDomainActionKeys] = useState<string[]>([]);
  const [tableDomainFilter, setTableDomainFilter] = useState("");
  const [tableClientFilter, setTableClientFilter] = useState("");
  const [newRowKeys, setNewRowKeys] = useState<string[]>([]);
  const [, setSuggestionsReloadToken] = useState(0);
  const suggestionQuery = useMemo(() => {
    const fromTimestamp = datetimeLocalToUnixSeconds(draftFilters.from, timeZone);
    const untilTimestamp = datetimeLocalToUnixSeconds(draftFilters.until, timeZone);

    return {
      scope: scope.kind === "all" ? "all" : "instance",
      ...(scope.kind === "instance" ? { instanceId: scope.instanceId } : {}),
      ...(fromTimestamp !== undefined ? { from: fromTimestamp } : {}),
      ...(untilTimestamp !== undefined ? { until: untilTimestamp } : {}),
      ...(trimOrEmpty(draftFilters.domain) ? { domain: trimOrEmpty(draftFilters.domain) } : {}),
      ...(trimOrEmpty(draftFilters.clientIp) ? { client_ip: trimOrEmpty(draftFilters.clientIp) } : {}),
      ...(trimOrEmpty(draftFilters.upstream) ? { upstream: trimOrEmpty(draftFilters.upstream) } : {}),
      ...(trimOrEmpty(draftFilters.type) ? { type: trimOrEmpty(draftFilters.type) } : {}),
      ...(trimOrEmpty(draftFilters.status) ? { status: trimOrEmpty(draftFilters.status) } : {}),
      ...(trimOrEmpty(draftFilters.reply) ? { reply: trimOrEmpty(draftFilters.reply) } : {}),
      ...(trimOrEmpty(draftFilters.dnssec) ? { dnssec: trimOrEmpty(draftFilters.dnssec) } : {}),
      ...(draftFilters.disk ? { disk: true } : {}),
    };
  }, [
    draftFilters.clientIp,
    draftFilters.disk,
    draftFilters.dnssec,
    draftFilters.domain,
    draftFilters.from,
    draftFilters.reply,
    draftFilters.status,
    draftFilters.type,
    draftFilters.until,
    draftFilters.upstream,
    scope,
    timeZone,
  ]);

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
    const normalizedData = normalizeQueriesResponse(initialData, activeFiltersRef.current);

    setQueryData(normalizedData);
  }, [initialData]);

  useEffect(() => {
    currentDataRef.current = queryData;
  }, [queryData]);

  useEffect(() => {
    let active = true;

    async function refreshGroupMemberships() {
      const { data, response } = await client.POST<QueryGroupMembershipRefreshResponse>(
        "/queries/group-memberships/refresh",
        {
          headers: {
            "x-yapd-csrf": csrfToken,
          },
        },
      );

      if (!active || !mountedRef.current || !response.ok || !data) {
        return;
      }

      if (!data.requiresGroupReview) {
        window.sessionStorage.removeItem(QUERY_GROUP_REVIEW_FINGERPRINT_STORAGE_KEY);
      } else {
        const fingerprint = [
          `${data.summary.instancesNeedingReview}`,
          `${data.summary.failedInstances}`,
          ...data.failedInstances.map((failure) => `${failure.instanceId}:${failure.kind}:${failure.message}`).sort(),
        ].join("|");
        const storedFingerprint = window.sessionStorage.getItem(QUERY_GROUP_REVIEW_FINGERPRINT_STORAGE_KEY);

        if (storedFingerprint !== fingerprint) {
          window.sessionStorage.setItem(QUERY_GROUP_REVIEW_FINGERPRINT_STORAGE_KEY, fingerprint);
          toast.warning(
            messages.queries.toasts.groupReviewWarning(
              data.summary.instancesNeedingReview,
              data.summary.failedInstances,
            ),
            {
              id: "queries-group-review-warning",
              action: {
                label: messages.queries.toasts.reviewGroupsAction,
                onClick: () => {
                  window.location.assign(data.reviewPath);
                },
              },
            },
          );
        }
      }

      setSuggestionsReloadToken((current) => current + 1);
      void refreshQueriesRef.current?.(activeFiltersRef.current, {
        preserveTable: true,
        silent: true,
      });
    }

    void refreshGroupMemberships();

    return () => {
      active = false;
    };
  }, [client, csrfToken, messages.queries.toasts.groupReviewWarning, messages.queries.toasts.reviewGroupsAction]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      void loadSuggestions();
    }, 250);

    async function loadSuggestions() {
      setIsSuggestionsLoading(true);
      const { data, response } = await client.GET<QuerySuggestionsResponse>("/queries/suggestions", {
        params: {
          query: suggestionQuery,
        },
      });

      if (!active || !mountedRef.current) {
        return;
      }

      if (response.ok && data) {
        setSuggestions(data.suggestions);
        setGroupOptions(data.groupOptions);
      } else {
        setSuggestions(EMPTY_SUGGESTIONS);
      }

      setIsSuggestionsLoading(false);
    }

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [client, suggestionQuery]);

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
      const fromTimestamp = datetimeLocalToUnixSeconds(filters.from, timeZone);
      const untilTimestamp = datetimeLocalToUnixSeconds(filters.until, timeZone);
      const { data, response } = await client.GET<QueriesResponse>("/queries", {
        params: {
          query: {
            scope: scope.kind === "all" ? "all" : "instance",
            ...(scope.kind === "instance" ? { instanceId: scope.instanceId } : {}),
            ...(fromTimestamp !== undefined
              ? {
                  from: fromTimestamp,
                }
              : {}),
            ...(untilTimestamp !== undefined
              ? {
                  until: untilTimestamp,
                }
              : {}),
            length: clampQueryLength(filters.length),
            start: Math.max(0, filters.start),
            ...(trimOrEmpty(filters.domain) ? { domain: trimOrEmpty(filters.domain) } : {}),
            ...(trimOrEmpty(filters.clientIp) ? { client_ip: trimOrEmpty(filters.clientIp) } : {}),
            ...(filters.groupIds.length > 0 ? { groupIds: filters.groupIds } : {}),
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

      const normalizedData = normalizeQueriesResponse(data, filters);

      if (options?.highlightNew && filters.start === 0) {
        const currentKeys = new Set(currentDataRef.current.queries.map(buildRowKey));
        const insertedKeys = normalizedData.queries.map(buildRowKey).filter((key) => !currentKeys.has(key));

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

      setQueryData(normalizedData);
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

  function handleLiveEnabledChange(enabled: boolean) {
    if (!enabled) {
      setIsLiveEnabled(false);
      return;
    }

    const currentFilters = activeFiltersRef.current;

    if (currentFilters.disk) {
      setIsLiveEnabled(false);
      return;
    }

    if (currentFilters.start === 0) {
      setIsLiveEnabled(true);
      return;
    }

    const nextFilters = {
      ...currentFilters,
      start: 0,
    } satisfies QueryFilters;

    activeFiltersRef.current = nextFilters;
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    setNewRowKeys([]);
    setIsLiveEnabled(true);
    void refreshQueries(nextFilters, { preserveTable: true, silent: true });
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
        groupOptions={groupOptions}
        isFiltersOpen={isFiltersOpen}
        isReloading={isReloading}
        isSuggestionsLoading={isSuggestionsLoading}
        messages={messages}
        responsiveSummary={responsiveSummary}
        setIsFiltersOpen={setIsFiltersOpen}
        setIsLiveEnabled={handleLiveEnabledChange}
        suggestions={suggestions}
        timeZone={timeZone}
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
        setIsLiveEnabled={handleLiveEnabledChange}
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
