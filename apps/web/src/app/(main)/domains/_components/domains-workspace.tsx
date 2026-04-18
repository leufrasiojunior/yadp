"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  CircleDot,
  Code2,
  Download,
  Globe,
  Info,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { ManagedItemsPagination } from "@/app/(main)/_components/managed-items-pagination";
import { ManagedItemsPartialAlert } from "@/app/(main)/_components/managed-items-partial-alert";
import { ManagedItemsSearchInput } from "@/app/(main)/_components/managed-items-search-input";
import { ManagedItemsTableSkeleton } from "@/app/(main)/_components/managed-items-table-skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getBrowserApiBaseUrl } from "@/lib/api/base-url";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient, redirectToLogin } from "@/lib/api/yapd-client";
import type {
  DomainFilterValue,
  DomainItem,
  DomainOperationResponse,
  DomainPatternMode,
  DomainsImportResponse,
  DomainsListResponse,
  DomainsMutationResponse,
  DomainsSortDirection,
  DomainsSortField,
  GroupItem,
} from "@/lib/api/yapd-types";
import { getClientCookie, setClientCookie } from "@/lib/cookie.client";
import {
  ALL_DOMAIN_FILTERS,
  DEFAULT_DOMAINS_SORT_DIRECTION,
  DEFAULT_DOMAINS_SORT_FIELD,
  getDefaultDomainsSortDirection,
} from "@/lib/domains/domains-sorting";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useNavigationSummaryStore } from "@/stores/navigation-summary/navigation-summary-provider";

import { CreateDomainGroupSelector } from "./create-domain-group-selector";
import { DomainEditDialog } from "./domain-edit-dialog";
import { DomainGroupEditor } from "./domain-group-editor";
import { DomainStatusToggle } from "./domain-status-toggle";

type DeleteDialogState = {
  items: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[];
  title: string;
  description: string;
} | null;

type DomainSyncInstanceState = {
  instanceId: string;
  instanceName: string;
  hasDomain: boolean;
};

function getDomainKey(item: Pick<DomainItem, "domain" | "type" | "kind">) {
  return `${item.domain}-${item.type}-${item.kind}`;
}

function sortSyncInstanceStates(states: DomainSyncInstanceState[], baselineInstanceId: string) {
  return [...states].sort((left, right) => {
    if (left.instanceId === baselineInstanceId && right.instanceId !== baselineInstanceId) {
      return -1;
    }

    if (left.instanceId !== baselineInstanceId && right.instanceId === baselineInstanceId) {
      return 1;
    }

    return left.instanceName.localeCompare(right.instanceName);
  });
}

function getDomainSyncInstanceStates(item: DomainItem, baselineInstanceId: string) {
  const instanceStates = new Map<string, DomainSyncInstanceState>();

  for (const instance of item.sync.sourceInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasDomain: true,
    });
  }

  for (const instance of item.sync.missingInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasDomain: false,
    });
  }

  return sortSyncInstanceStates([...instanceStates.values()], baselineInstanceId);
}

function buildDefaultSyncTargetIds(item: DomainItem, baselineInstanceId: string, sourceInstanceId: string) {
  const sourceState = getDomainSyncInstanceStates(item, baselineInstanceId).find(
    (instance) => instance.instanceId === sourceInstanceId,
  );

  if (!sourceState) {
    return [];
  }

  return getDomainSyncInstanceStates(item, baselineInstanceId)
    .filter((instance) => instance.instanceId !== sourceInstanceId && instance.hasDomain !== sourceState.hasDomain)
    .map((instance) => instance.instanceId);
}

export function DomainsWorkspace({
  initialData,
  groups,
}: Readonly<{
  initialData: DomainsListResponse;
  groups: GroupItem[];
}>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const refreshNavigationSummary = useNavigationSummaryStore((state) => state.refreshSummary);
  const [data, setData] = useState(initialData);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([0]);
  const [newPatternMode, setNewPatternMode] = useState<DomainPatternMode>("exact");
  const [activeFilters, setActiveFilters] = useState<DomainFilterValue[]>(ALL_DOMAIN_FILTERS);
  const [editingItem, setEditingItem] = useState<DomainItem | null>(null);
  const [syncItem, setSyncItem] = useState<DomainItem | null>(null);
  const [syncSourceInstanceId, setSyncSourceInstanceId] = useState("");
  const [syncTargetInstanceIds, setSyncTargetInstanceIds] = useState<string[]>([]);
  const [isBulkSyncDialogOpen, setIsBulkSyncDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<DomainsSortField>(DEFAULT_DOMAINS_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<DomainsSortDirection>(DEFAULT_DOMAINS_SORT_DIRECTION);

  const isReloading =
    busyAction === "refresh" ||
    busyAction === "page" ||
    busyAction === "page-size" ||
    busyAction === "sort" ||
    busyAction === "search" ||
    busyAction === "filters";
  const isMutating = busyAction !== null;

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const allVisibleSelected =
    data.items.length > 0 && data.items.every((item) => selectedKeySet.has(getDomainKey(item)));
  const someVisibleSelected = data.items.some((item) => selectedKeySet.has(getDomainKey(item)));
  const selectedItems = data.items.filter((item) => selectedKeySet.has(getDomainKey(item)));
  const syncInstanceStates = useMemo(
    () => (syncItem ? getDomainSyncInstanceStates(syncItem, data.source.baselineInstanceId) : []),
    [data.source.baselineInstanceId, syncItem],
  );
  const syncTargetStates = syncInstanceStates.filter((instance) => instance.instanceId !== syncSourceInstanceId);

  const refreshDomains = useCallback(
    async (
      page = data.pagination.page,
      pageSize = data.pagination.pageSize,
      nextSortBy = sortBy,
      nextSortDirection = sortDirection,
      nextSearchTerm = searchTerm,
      nextFilters = activeFilters,
    ) => {
      const { data: nextData, response } = await client.GET<DomainsListResponse>("/domains", {
        params: {
          query: {
            page,
            pageSize,
            sortBy: nextSortBy,
            sortDirection: nextSortDirection,
            search: nextSearchTerm,
            filters: nextFilters,
          },
        },
      });

      if (!response.ok || !nextData) {
        toast.error(messages.domains.toasts.refreshFailed);
        return null;
      }

      setData(nextData);
      return nextData;
    },
    [
      activeFilters,
      client,
      data.pagination.page,
      data.pagination.pageSize,
      messages.domains.toasts.refreshFailed,
      searchTerm,
      sortBy,
      sortDirection,
    ],
  );

  const buildCurrentQueryString = useCallback(() => {
    const searchParams = new URLSearchParams();
    searchParams.set("sortBy", sortBy);
    searchParams.set("sortDirection", sortDirection);

    if (searchTerm.length > 0) {
      searchParams.set("search", searchTerm);
    }

    activeFilters.forEach((filter) => {
      searchParams.append("filters", filter);
    });

    return searchParams.toString();
  }, [activeFilters, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    setSkipDeleteConfirm(getClientCookie(FRONTEND_CONFIG.domains.deleteConfirmCookieKey) === "1");
  }, []);

  useEffect(() => {
    const visibleKeys = new Set(data.items.map((item) => getDomainKey(item)));
    setSelectedKeys((current) => current.filter((key) => visibleKeys.has(key)));
  }, [data.items]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const nextSearchTerm = searchDraft.trim();

      if (nextSearchTerm === searchTerm) {
        return;
      }

      const applySearch = async () => {
        setBusyAction("search");

        try {
          const nextData = await refreshDomains(
            1,
            data.pagination.pageSize,
            sortBy,
            sortDirection,
            nextSearchTerm,
            activeFilters,
          );

          if (!cancelled && nextData) {
            setSearchTerm(nextSearchTerm);
          }
        } finally {
          if (!cancelled) {
            setBusyAction(null);
          }
        }
      };

      void applySearch();
    }, FRONTEND_CONFIG.domains.searchDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeFilters, data.pagination.pageSize, refreshDomains, searchDraft, searchTerm, sortBy, sortDirection]);

  const notifyMutationResult = useCallback(
    (
      responseData: DomainsMutationResponse | DomainOperationResponse,
      options: {
        successMessage: string;
        partialMessage: (successCount: number, failedCount: number) => string;
      },
    ) => {
      if (responseData.failedInstances.length === 0) {
        toast.success(options.successMessage);
        return;
      }

      toast.warning(options.partialMessage(responseData.summary.successfulCount, responseData.summary.failedCount));
      responseData.failedInstances.forEach((failure) => {
        toast.error(messages.domains.toasts.instanceFailure(failure.instanceName, failure.message), {
          description: messages.domains.toasts.syncHint,
        });
      });
    },
    [messages.domains.toasts.instanceFailure, messages.domains.toasts.syncHint],
  );

  const runRefresh = async () => {
    setBusyAction("refresh");

    try {
      await refreshDomains();
    } finally {
      setBusyAction(null);
    }
  };

  const exportCsv = async () => {
    setBusyAction("export");

    try {
      const queryString = buildCurrentQueryString();
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/domains/export${queryString.length > 0 ? `?${queryString}` : ""}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            accept: "text/csv",
          },
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/i);
      link.href = downloadUrl;
      link.download = filenameMatch?.[1] ?? "domains.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(messages.domains.toasts.exportSuccess);
    } finally {
      setBusyAction(null);
    }
  };

  const submitImport = async () => {
    if (!importFile) {
      toast.error(messages.domains.csv.fileRequired);
      return;
    }

    setBusyAction("import");

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch(`${getBrowserApiBaseUrl()}/domains/import`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-yapd-csrf": csrfToken,
          accept: "application/json",
        },
        body: formData,
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      const payload = (await response.json()) as DomainsImportResponse;
      const nextErrors = payload.errors.map((error) => `${error.line}: ${error.message}`);
      setImportErrors(nextErrors);

      if (payload.summary.invalidCount > 0) {
        toast.warning(
          messages.domains.toasts.importPartial(
            payload.summary.createdCount,
            payload.summary.updatedCount,
            payload.summary.invalidCount,
          ),
        );
      } else {
        toast.success(
          messages.domains.toasts.importSuccess(payload.summary.createdCount, payload.summary.updatedCount),
        );
        setIsImportDialogOpen(false);
        setImportFile(null);
      }

      await refreshDomains(1, data.pagination.pageSize);
      await refreshNavigationSummary();
    } finally {
      setBusyAction(null);
    }
  };

  const changePageSize = async (nextPageSize: number) => {
    setBusyAction("page-size");

    try {
      await refreshDomains(1, nextPageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const goToPage = async (page: number) => {
    setBusyAction("page");

    try {
      await refreshDomains(page, data.pagination.pageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSort = async (field: DomainsSortField) => {
    const nextSortDirection =
      sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : getDefaultDomainsSortDirection(field);

    setBusyAction("sort");

    try {
      const nextData = await refreshDomains(1, data.pagination.pageSize, field, nextSortDirection);

      if (!nextData) {
        return;
      }

      setSortBy(field);
      setSortDirection(nextSortDirection);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleFilter = async (filter: DomainFilterValue, checked: boolean) => {
    if (checked !== true && activeFilters.length === 1 && activeFilters.includes(filter)) {
      return;
    }

    const nextFilters = checked
      ? [...new Set([...activeFilters, filter])]
      : activeFilters.filter((value) => value !== filter);

    setBusyAction("filters");

    try {
      const nextData = await refreshDomains(
        1,
        data.pagination.pageSize,
        sortBy,
        sortDirection,
        searchTerm,
        nextFilters,
      );

      if (!nextData) {
        return;
      }

      setActiveFilters(nextFilters);
    } finally {
      setBusyAction(null);
    }
  };

  const submitCreate = async (type: "allow" | "deny") => {
    if (!newDomain.trim()) {
      return;
    }

    const piholeKind = newPatternMode === "exact" ? "exact" : "regex";

    setBusyAction(`create:${type}`);
    const { data: responseData, response } = await client.POST<DomainOperationResponse>("/domains/{type}/{kind}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: {
          type,
          kind: piholeKind,
        },
      },
      body: {
        domain: newDomain.trim(),
        comment: newComment.trim() || messages.domains.defaultComment,
        scope: "all",
        groups: newGroupIds,
        patternMode: newPatternMode,
      },
    });
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: messages.domains.toasts.createSuccess,
      partialMessage: messages.domains.toasts.updatePartial,
    });
    setNewDomain("");
    setNewComment("");
    setNewGroupIds([0]);
    setNewPatternMode("exact");
    await refreshDomains();
    await refreshNavigationSummary();
  };

  const toggleStatus = async (item: DomainItem, enabled: boolean) => {
    const key = getDomainKey(item);
    setBusyAction(`toggle:${key}`);

    const { data: responseData, response } = await client.PUT<DomainsMutationResponse>(
      "/domains/{domain}/{type}/{kind}",
      {
        headers: { "x-yapd-csrf": csrfToken },
        params: {
          path: {
            domain: item.domain,
            type: item.type,
            kind: item.kind,
          },
        },
        body: {
          comment: item.comment,
          groups: item.groups,
          enabled,
        },
      },
    );
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: enabled ? messages.domains.toasts.enabledSuccess : messages.domains.toasts.disabledSuccess,
      partialMessage: messages.domains.toasts.updatePartial,
    });
    await refreshDomains();
  };

  const saveEdit = async (item: DomainItem, groupIds: number[], comment: string | null) => {
    const key = getDomainKey(item);
    setBusyAction(`edit:${key}`);

    const { data: responseData, response } = await client.PUT<DomainsMutationResponse>(
      "/domains/{domain}/{type}/{kind}",
      {
        headers: { "x-yapd-csrf": csrfToken },
        params: {
          path: {
            domain: item.domain,
            type: item.type,
            kind: item.kind,
          },
        },
        body: {
          comment,
          groups: groupIds,
          enabled: item.enabled,
        },
      },
    );
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: messages.domains.toasts.updateSuccess,
      partialMessage: messages.domains.toasts.updatePartial,
    });
    await refreshDomains();
  };

  const executeDelete = async (itemsToDelete: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[]) => {
    setBusyAction("delete");
    const { data: responseData, response } = await client.POST<DomainsMutationResponse>("/domains/batchDelete", {
      headers: { "x-yapd-csrf": csrfToken },
      body: { items: itemsToDelete },
    });
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setDeleteDialog(null);
    setSelectedKeys([]);
    notifyMutationResult(responseData, {
      successMessage: messages.domains.toasts.deleteSuccess,
      partialMessage: messages.domains.toasts.updatePartial,
    });
    await refreshDomains();
    await refreshNavigationSummary();
  };

  const requestDelete = (itemsToDelete: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[]) => {
    if (isMutating || itemsToDelete.length === 0) {
      return;
    }

    if (skipDeleteConfirm) {
      void executeDelete(itemsToDelete);
      return;
    }

    const firstItem = itemsToDelete[0];

    if (!firstItem) {
      return;
    }

    setDeleteDialog({
      items: itemsToDelete,
      title:
        itemsToDelete.length === 1
          ? messages.domains.delete.titleSingle(firstItem.item)
          : messages.domains.delete.titleBatch(itemsToDelete.length),
      description:
        itemsToDelete.length === 1
          ? messages.domains.delete.descriptionSingle(firstItem.item)
          : messages.domains.delete.descriptionBatch(itemsToDelete.length),
    });
  };

  const openSyncDialog = (item: DomainItem) => {
    if (isMutating) {
      return;
    }

    setSyncItem(item);
    setSyncSourceInstanceId(item.origin.instanceId);
    setSyncTargetInstanceIds(buildDefaultSyncTargetIds(item, data.source.baselineInstanceId, item.origin.instanceId));
  };

  const closeSyncDialog = () => {
    if (syncItem && busyAction === `sync:${getDomainKey(syncItem)}`) {
      return;
    }

    setSyncItem(null);
    setSyncSourceInstanceId("");
    setSyncTargetInstanceIds([]);
  };

  const runBulkSync = async () => {
    setBusyAction("sync:all");
    const { data: responseData, response } = await client.POST<DomainsMutationResponse>("/domains/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {},
    });
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setIsBulkSyncDialogOpen(false);
    notifyMutationResult(responseData, {
      successMessage: messages.domains.toasts.syncSuccess,
      partialMessage: messages.domains.toasts.partialWarning,
    });
    await refreshDomains();
  };

  const syncSingle = async () => {
    if (!syncItem) {
      return;
    }

    if (syncTargetInstanceIds.length === 0) {
      toast.error(messages.domains.syncDialog.targetsRequired);
      return;
    }

    setBusyAction(`sync:${getDomainKey(syncItem)}`);
    const { data: responseData, response } = await client.POST<DomainsMutationResponse>("/domains/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        domain: syncItem.domain,
        type: syncItem.type,
        kind: syncItem.kind,
        sourceInstanceId: syncSourceInstanceId,
        targetInstanceIds: syncTargetInstanceIds,
      },
    });
    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: messages.domains.toasts.syncItemSuccess(syncItem.domain),
      partialMessage: messages.domains.toasts.partialWarning,
    });
    closeSyncDialog();
    await refreshDomains();
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(data.items.map((item) => getDomainKey(item)));
      return;
    }

    setSelectedKeys([]);
  };

  const toggleSelectRow = (item: DomainItem, checked: boolean) => {
    const key = getDomainKey(item);
    setSelectedKeys((current) =>
      checked ? [...new Set([...current, key])] : current.filter((value) => value !== key),
    );
  };

  const renderSortIcon = (field: DomainsSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="size-3.5" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex flex-col items-center">
                <p className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.16em]">
                  <Globe className="size-3.5" />
                  {messages.domains.summary.total}
                </p>
                <p className="mt-2 font-semibold text-3xl">{data.summary.totalItems}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="rounded-full px-2.5">
                  <Globe className="mr-1 size-3.5" />
                  {messages.common.total}: {data.summary.totalItems}
                </Badge>
                <Badge className="rounded-full bg-emerald-600 px-2.5 text-white hover:bg-emerald-600">
                  <ShieldCheck className="mr-1 size-3.5" />
                  {messages.domains.summary.allowed}: {data.summary.allowTotal}
                </Badge>
                <Badge variant="destructive" className="rounded-full px-2.5">
                  <ShieldX className="mr-1 size-3.5" />
                  {messages.domains.summary.blocked}: {data.summary.denyTotal}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-medium text-emerald-700 text-sm dark:text-emerald-300">
              <ShieldCheck className="size-4" />
              {messages.domains.summary.allowed}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <Globe className="size-3.5" />
                  {messages.common.total}
                </p>
                <p className="font-semibold text-xl">{data.summary.allowTotal}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <CircleDot className="size-3.5" />
                  {messages.domains.summary.exact}
                </p>
                <p className="font-semibold text-xl">{data.summary.allowExact}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <Code2 className="size-3.5" />
                  {messages.domains.summary.regex}
                </p>
                <p className="font-semibold text-xl">{data.summary.allowRegex}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-medium text-red-700 text-sm dark:text-red-300">
              <ShieldX className="size-4" />
              {messages.domains.summary.blocked}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <Globe className="size-3.5" />
                  {messages.common.total}
                </p>
                <p className="font-semibold text-xl">{data.summary.denyTotal}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <CircleDot className="size-3.5" />
                  {messages.domains.summary.exact}
                </p>
                <p className="font-semibold text-xl">{data.summary.denyExact}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                  <Code2 className="size-3.5" />
                  {messages.domains.summary.regex}
                </p>
                <p className="font-semibold text-xl">{data.summary.denyRegex}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.common.add}</CardTitle>
          <CardDescription>{messages.domains.create.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-domain">{messages.domains.create.domainLabel}</FieldLabel>
              <Input
                id="new-domain"
                placeholder="example.com"
                value={newDomain}
                onChange={(event) => setNewDomain(event.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel>{messages.domains.create.kindLabel}</FieldLabel>
              <Select
                value={newPatternMode}
                onValueChange={(value) => setNewPatternMode(value as DomainPatternMode)}
                disabled={isMutating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">{messages.domains.create.kinds.exact.label}</SelectItem>
                  <SelectItem value="regex_specific">{messages.domains.create.kinds.regexSpecific.label}</SelectItem>
                  <SelectItem value="regex_any">{messages.domains.create.kinds.regexAny.label}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-comment">{messages.domains.create.commentLabel}</FieldLabel>
              <Input
                id="new-comment"
                placeholder="..."
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel>{messages.domains.create.groupLabel}</FieldLabel>
              <CreateDomainGroupSelector
                groups={groups}
                selectedGroupIds={newGroupIds}
                onChange={setNewGroupIds}
                disabled={isMutating}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => void submitCreate("allow")}
                disabled={isMutating || !newDomain.trim()}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 lg:w-auto"
              >
                {busyAction === "create:allow"
                  ? messages.domains.create.submitLoading
                  : messages.domains.table.addAllow}
              </Button>
              <Button
                onClick={() => void submitCreate("deny")}
                disabled={isMutating || !newDomain.trim()}
                variant="destructive"
                className="w-full lg:w-auto"
              >
                {busyAction === "create:deny" ? messages.domains.create.submitLoading : messages.domains.table.addDeny}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-xs italic">
            {newPatternMode === "exact"
              ? messages.domains.create.kinds.exact.description
              : newPatternMode === "regex_specific"
                ? messages.domains.create.kinds.regexSpecific.description
                : messages.domains.create.kinds.regexAny.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{messages.domains.table.title}</CardTitle>
            <CardDescription>{messages.domains.table.description(data.source.baselineInstanceName)}</CardDescription>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ManagedItemsSearchInput
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder={messages.domains.table.searchPlaceholder}
              clearLabel={messages.domains.table.searchClear}
              disabled={busyAction !== null && busyAction !== "search"}
            />
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void runRefresh()}>
              <RefreshCw className={cn(busyAction === "refresh" ? "animate-spin" : undefined)} />
              {busyAction === "refresh" ? messages.domains.table.refreshLoading : messages.domains.table.refresh}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void exportCsv()}>
              <Download className={cn(busyAction === "export" ? "animate-pulse" : undefined)} />
              {busyAction === "export" ? messages.domains.csv.exportLoading : messages.domains.csv.export}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className={cn(busyAction === "import" ? "animate-pulse" : undefined)} />
              {messages.domains.csv.import}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => setIsBulkSyncDialogOpen(true)}
            >
              <ArrowLeftRight className={cn(busyAction === "sync:all" ? "animate-pulse" : undefined)} />
              {busyAction === "sync:all" ? messages.domains.table.syncLoading : messages.domains.table.sync}
            </Button>
            {selectedItems.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() =>
                  requestDelete(
                    selectedItems.map((item) => ({
                      item: item.domain,
                      type: item.type,
                      kind: item.kind,
                    })),
                  )
                }
              >
                {messages.domains.table.deleteSelected(selectedItems.length)}
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {ALL_DOMAIN_FILTERS.map((filter) => {
              const checkboxId = `domain-filter-${filter}`;
              const messageKey =
                filter === "exact-allow"
                  ? messages.domains.filters.exactAllow
                  : filter === "regex-allow"
                    ? messages.domains.filters.regexAllow
                    : filter === "exact-deny"
                      ? messages.domains.filters.exactDeny
                      : messages.domains.filters.regexDeny;

              return (
                <div key={filter} className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={activeFilters.includes(filter)}
                    disabled={isMutating}
                    onCheckedChange={(checked) => void toggleFilter(filter, checked === true)}
                  />
                  <label htmlFor={checkboxId} className="cursor-pointer font-medium text-xs">
                    {messageKey}
                  </label>
                </div>
              );
            })}
          </div>

          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.domains.table.sync}
              description={messages.domains.alerts.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}

          {data.items.length === 0 && !isReloading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe />
                </EmptyMedia>
                <EmptyTitle>{messages.domains.table.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.domains.table.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ManagedItemsPagination
                changePageSize={(nextPageSize) => void changePageSize(nextPageSize)}
                goToPage={(page) => void goToPage(page)}
                isReloading={isReloading}
                nextLabel={messages.domains.table.next}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                previousLabel={messages.domains.table.previous}
                rowsPerPageLabel={messages.domains.table.rowsPerPage}
                showingLabel={messages.domains.table.showing}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
              />

              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                          disabled={isMutating}
                          aria-label={messages.domains.table.selectAll}
                        />
                      </TableHead>
                      <TableHead
                        aria-sort={
                          sortBy === "domain" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("domain")}
                        >
                          {messages.domains.table.domain}
                          {renderSortIcon("domain")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={sortBy === "type" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("type")}
                        >
                          {messages.domains.table.type}
                          {renderSortIcon("type")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={sortBy === "kind" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("kind")}
                        >
                          {messages.domains.table.kind}
                          {renderSortIcon("kind")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "enabled" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("enabled")}
                        >
                          {messages.domains.table.status}
                          {renderSortIcon("enabled")}
                        </Button>
                      </TableHead>
                      <TableHead
                        aria-sort={
                          sortBy === "comment" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("comment")}
                        >
                          {messages.domains.table.comment}
                          {renderSortIcon("comment")}
                        </Button>
                      </TableHead>
                      <TableHead
                        aria-sort={sortBy === "group" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("group")}
                        >
                          {messages.domains.table.group}
                          {renderSortIcon("group")}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">{messages.domains.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isReloading ? (
                      <ManagedItemsTableSkeleton columnCount={8} />
                    ) : (
                      data.items.map((item) => {
                        const rowKey = getDomainKey(item);

                        return (
                          <TableRow key={rowKey}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedKeySet.has(rowKey)}
                                onCheckedChange={(checked) => toggleSelectRow(item, checked === true)}
                                disabled={isMutating}
                                aria-label={messages.domains.table.selectRow(item.domain)}
                              />
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate font-medium font-mono text-xs" title={item.domain}>
                                    {item.domain}
                                  </span>
                                  {item.sync.missingInstances.length > 0 ? (
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      className="h-4 w-4 text-amber-600 hover:text-amber-700"
                                      disabled={isMutating}
                                      aria-label={messages.domains.table.syncIssueAction(item.domain)}
                                      title={messages.domains.table.syncIssueAction(item.domain)}
                                      onClick={() => openSyncDialog(item)}
                                    >
                                      <CircleAlert className="h-3 w-3" />
                                    </Button>
                                  ) : null}
                                </div>
                                {item.unicode && item.unicode !== item.domain ? (
                                  <span className="truncate text-muted-foreground text-xs">{item.unicode}</span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase",
                                  item.type === "allow"
                                    ? "border-emerald-500 text-emerald-600"
                                    : "border-rose-500 text-rose-600",
                                )}
                              >
                                {item.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {item.kind}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <DomainStatusToggle
                                checked={item.enabled}
                                disabled={isMutating}
                                activeLabel={
                                  busyAction === `toggle:${rowKey}` && item.enabled
                                    ? messages.domains.status.disabling
                                    : messages.domains.status.enabled
                                }
                                inactiveLabel={
                                  busyAction === `toggle:${rowKey}` && !item.enabled
                                    ? messages.domains.status.enabling
                                    : messages.domains.status.disabled
                                }
                                onCheckedChange={(checked) => void toggleStatus(item, checked)}
                              />
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <span
                                className={cn("block truncate text-sm", !item.comment && "text-muted-foreground")}
                                title={item.comment ?? messages.common.versionUnavailable}
                              >
                                {item.comment || messages.common.versionUnavailable}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DomainGroupEditor
                                item={item}
                                groups={groups}
                                disabled={isMutating}
                                onSave={(groupIds) => saveEdit(item, groupIds, item.comment)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon-sm" disabled={isMutating}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="gap-2" onClick={() => setEditingItem(item)}>
                                    <Info className="h-4 w-4" />
                                    {messages.domains.table.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-2 text-destructive focus:text-destructive"
                                    onClick={() =>
                                      requestDelete([{ item: item.domain, type: item.type, kind: item.kind }])
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {messages.domains.table.delete}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <ManagedItemsPagination
                changePageSize={(nextPageSize) => void changePageSize(nextPageSize)}
                goToPage={(page) => void goToPage(page)}
                isReloading={isReloading}
                nextLabel={messages.domains.table.next}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                previousLabel={messages.domains.table.previous}
                rowsPerPageLabel={messages.domains.table.rowsPerPage}
                showingLabel={messages.domains.table.showing}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
              />
            </>
          )}
        </CardContent>
      </Card>

      {editingItem ? (
        <DomainEditDialog
          item={editingItem}
          groups={groups}
          open={editingItem !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingItem(null);
            }
          }}
          onSave={(groupIds, comment) => saveEdit(editingItem, groupIds, comment)}
          disabled={isMutating}
        />
      ) : null}

      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);

          if (!open && busyAction !== "import") {
            setImportFile(null);
            setImportErrors([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{messages.domains.csv.importTitle}</DialogTitle>
            <DialogDescription>{messages.domains.csv.importDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="domains-import-file">{messages.domains.csv.importFileLabel}</FieldLabel>
              <Input
                id="domains-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={busyAction === "import"}
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                }}
              />
              <p className="text-muted-foreground text-xs">{messages.domains.csv.importHint}</p>
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="domains-import-errors">{messages.domains.csv.importErrorsLabel}</FieldLabel>
              <Textarea
                id="domains-import-errors"
                readOnly
                value={importErrors.length > 0 ? importErrors.join("\n") : messages.domains.csv.importErrorsPlaceholder}
                className="min-h-36"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={busyAction === "import"} onClick={() => setIsImportDialogOpen(false)}>
              {messages.domains.csv.importClose}
            </Button>
            <Button disabled={busyAction === "import"} onClick={() => void submitImport()}>
              {busyAction === "import" ? messages.domains.csv.importSubmitting : messages.domains.csv.importSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncItem !== null} onOpenChange={(open) => (!open ? closeSyncDialog() : undefined)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {syncItem
                ? messages.domains.syncDialog.titleSingle(syncItem.domain)
                : messages.domains.syncDialog.titleAll}
            </DialogTitle>
            <DialogDescription>
              {syncItem
                ? messages.domains.syncDialog.descriptionSingle(syncItem.domain)
                : messages.domains.syncDialog.descriptionAll(data.source.baselineInstanceName)}
            </DialogDescription>
          </DialogHeader>

          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.domains.table.sync}
              description={messages.domains.syncDialog.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}

          {syncItem ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{syncItem.domain}</p>
                  <Badge variant="outline" className="uppercase">
                    {syncItem.type}
                  </Badge>
                  <Badge variant="outline" className="uppercase">
                    {syncItem.kind}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground text-sm">
                  {messages.domains.syncDialog.availabilityHint(
                    syncItem.sync.sourceInstances.length,
                    syncItem.sync.missingInstances.length,
                  )}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel>{messages.domains.syncDialog.sourceLabel}</FieldLabel>
                  <Select
                    value={syncSourceInstanceId}
                    onValueChange={(value) => {
                      setSyncSourceInstanceId(value);

                      if (syncItem) {
                        setSyncTargetInstanceIds(
                          buildDefaultSyncTargetIds(syncItem, data.source.baselineInstanceId, value),
                        );
                      }
                    }}
                    disabled={isMutating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={messages.domains.syncDialog.sourcePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {syncInstanceStates.map((instance) => (
                        <SelectItem key={instance.instanceId} value={instance.instanceId}>
                          {instance.instanceName} ·{" "}
                          {instance.hasDomain
                            ? messages.domains.syncDialog.instanceHasItem
                            : messages.domains.syncDialog.instanceMissingItem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="space-y-2">
                  <FieldLabel>{messages.domains.syncDialog.targetsLabel}</FieldLabel>
                  {syncTargetStates.length > 0 ? (
                    <div className="grid gap-2">
                      {syncTargetStates.map((instance) => (
                        <div
                          key={instance.instanceId}
                          className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            id={`sync-domain-${syncItem.domain}-${instance.instanceId}`}
                            checked={syncTargetInstanceIds.includes(instance.instanceId)}
                            disabled={isMutating}
                            onCheckedChange={(checked) =>
                              setSyncTargetInstanceIds((current) =>
                                checked === true
                                  ? [...new Set([...current, instance.instanceId])]
                                  : current.filter((value) => value !== instance.instanceId),
                              )
                            }
                          />
                          <label
                            htmlFor={`sync-domain-${syncItem.domain}-${instance.instanceId}`}
                            className="flex-1 cursor-pointer"
                          >
                            {instance.instanceName}
                          </label>
                          <Badge variant="outline">
                            {instance.hasDomain
                              ? messages.domains.syncDialog.instanceHasItem
                              : messages.domains.syncDialog.instanceMissingItem}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">{messages.domains.syncDialog.noTargets}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" disabled={isMutating} onClick={closeSyncDialog}>
              {messages.domains.syncDialog.close}
            </Button>
            <Button disabled={isMutating || syncTargetInstanceIds.length === 0} onClick={() => void syncSingle()}>
              <ArrowLeftRight
                className={cn("mr-2 h-4 w-4", busyAction?.startsWith("sync:") ? "animate-spin" : undefined)}
              />
              {busyAction?.startsWith("sync:")
                ? messages.domains.syncDialog.syncLoading
                : messages.domains.syncDialog.syncAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBulkSyncDialogOpen} onOpenChange={setIsBulkSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.domains.syncDialog.bulkTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.domains.syncDialog.bulkDescription(data.source.baselineInstanceName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.domains.table.sync}
              description={messages.domains.syncDialog.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.domains.syncDialog.close}</AlertDialogCancel>
            <Button disabled={isMutating} onClick={() => void runBulkSync()}>
              {busyAction === "sync:all"
                ? messages.domains.syncDialog.syncLoading
                : messages.domains.syncDialog.confirmBulk}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => (!open && !isMutating ? setDeleteDialog(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <p className="text-rose-600 text-sm">{messages.domains.delete.irreversible}</p>
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                id="domains-delete-skip-confirm"
                checked={rememberDeleteChoice}
                onCheckedChange={(checked) => setRememberDeleteChoice(checked === true)}
                disabled={isMutating}
              />
              <label htmlFor="domains-delete-skip-confirm">{messages.domains.delete.dontAskAgain}</label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.domains.delete.cancel}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isMutating}
              onClick={() => {
                if (!deleteDialog) {
                  return;
                }

                if (rememberDeleteChoice) {
                  setClientCookie(
                    FRONTEND_CONFIG.domains.deleteConfirmCookieKey,
                    "1",
                    FRONTEND_CONFIG.domains.deleteConfirmCookieDays,
                  );
                  setSkipDeleteConfirm(true);
                }

                void executeDelete(deleteDialog.items);
              }}
            >
              {isMutating
                ? messages.domains.delete.confirmLoading
                : deleteDialog && deleteDialog.items.length > 1
                  ? messages.domains.delete.confirmBatch(deleteDialog.items.length)
                  : messages.domains.delete.confirmSingle}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
