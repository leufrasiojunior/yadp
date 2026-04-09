"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  Info,
  List,
  MoreHorizontal,
  RefreshCw,
  Trash2,
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
import { useAppSession } from "@/components/yapd/app-session-provider";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  GroupItem,
  ListItem,
  ListsListResponse,
  ListsMutationResponse,
  ListsSortDirection,
  ListsSortField,
} from "@/lib/api/yapd-types";
import { getClientCookie, setClientCookie } from "@/lib/cookie.client";
import { useWebI18n } from "@/lib/i18n/client";
import {
  DEFAULT_LISTS_SORT_DIRECTION,
  DEFAULT_LISTS_SORT_FIELD,
  getDefaultListsSortDirection,
} from "@/lib/lists/lists-sorting";
import { cn } from "@/lib/utils";

import { CreateListGroupSelector } from "./create-list-group-selector";
import { ListEditDialog } from "./list-edit-dialog";
import { ListGroupEditor } from "./list-group-editor";
import { ListStatusToggle } from "./list-status-toggle";

type DeleteDialogState = {
  items: { item: string; type: "allow" | "block" }[];
  title: string;
  description: string;
} | null;

type ListSyncInstanceState = {
  instanceId: string;
  instanceName: string;
  hasList: boolean;
};

function getListKey(item: Pick<ListItem, "address" | "type">) {
  return `${item.address}-${item.type}`;
}

function sortSyncInstanceStates(states: ListSyncInstanceState[], baselineInstanceId: string) {
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

function getListSyncInstanceStates(item: ListItem, baselineInstanceId: string) {
  const instanceStates = new Map<string, ListSyncInstanceState>();

  for (const instance of item.sync.sourceInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasList: true,
    });
  }

  for (const instance of item.sync.missingInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasList: false,
    });
  }

  return sortSyncInstanceStates([...instanceStates.values()], baselineInstanceId);
}

function buildDefaultSyncTargetIds(item: ListItem, baselineInstanceId: string, sourceInstanceId: string) {
  const sourceState = getListSyncInstanceStates(item, baselineInstanceId).find(
    (instance) => instance.instanceId === sourceInstanceId,
  );

  if (!sourceState) {
    return [];
  }

  return getListSyncInstanceStates(item, baselineInstanceId)
    .filter((instance) => instance.instanceId !== sourceInstanceId && instance.hasList !== sourceState.hasList)
    .map((instance) => instance.instanceId);
}

export function ListsWorkspace({
  initialData,
  groups,
}: Readonly<{
  initialData: ListsListResponse;
  groups: GroupItem[];
}>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const [data, setData] = useState(initialData);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([0]);
  const [editingList, setEditingList] = useState<ListItem | null>(null);
  const [syncList, setSyncList] = useState<ListItem | null>(null);
  const [syncSourceInstanceId, setSyncSourceInstanceId] = useState("");
  const [syncTargetInstanceIds, setSyncTargetInstanceIds] = useState<string[]>([]);
  const [isBulkSyncDialogOpen, setIsBulkSyncDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<ListsSortField>(DEFAULT_LISTS_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<ListsSortDirection>(DEFAULT_LISTS_SORT_DIRECTION);

  const isReloading =
    busyAction === "refresh" ||
    busyAction === "page" ||
    busyAction === "page-size" ||
    busyAction === "sort" ||
    busyAction === "search";
  const isMutating = busyAction !== null;

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const allVisibleSelected = data.items.length > 0 && data.items.every((item) => selectedKeySet.has(getListKey(item)));
  const someVisibleSelected = data.items.some((item) => selectedKeySet.has(getListKey(item)));
  const selectedItems = data.items.filter((item) => selectedKeySet.has(getListKey(item)));
  const syncInstanceStates = useMemo(
    () => (syncList ? getListSyncInstanceStates(syncList, data.source.baselineInstanceId) : []),
    [data.source.baselineInstanceId, syncList],
  );
  const syncTargetStates = syncInstanceStates.filter((instance) => instance.instanceId !== syncSourceInstanceId);

  const refreshLists = useCallback(
    async (
      page = data.pagination.page,
      pageSize = data.pagination.pageSize,
      nextSortBy = sortBy,
      nextSortDirection = sortDirection,
      nextSearchTerm = searchTerm,
    ) => {
      const { data: nextData, response } = await client.GET<ListsListResponse>("/lists", {
        params: {
          query: {
            page,
            pageSize,
            sortBy: nextSortBy,
            sortDirection: nextSortDirection,
            search: nextSearchTerm,
          },
        },
      });

      if (!response.ok || !nextData) {
        toast.error(messages.lists.toasts.refreshFailed);
        return null;
      }

      setData(nextData);
      return nextData;
    },
    [
      client,
      data.pagination.page,
      data.pagination.pageSize,
      messages.lists.toasts.refreshFailed,
      searchTerm,
      sortBy,
      sortDirection,
    ],
  );

  useEffect(() => {
    setSkipDeleteConfirm(getClientCookie(FRONTEND_CONFIG.lists.deleteConfirmCookieKey) === "1");
  }, []);

  useEffect(() => {
    const visibleKeys = new Set(data.items.map((item) => getListKey(item)));
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
          const nextData = await refreshLists(1, data.pagination.pageSize, sortBy, sortDirection, nextSearchTerm);

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
    }, FRONTEND_CONFIG.lists.searchDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [data.pagination.pageSize, refreshLists, searchDraft, searchTerm, sortBy, sortDirection]);

  const notifyMutationResult = useCallback(
    (
      responseData: ListsMutationResponse,
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
        toast.error(messages.lists.toasts.instanceFailure(failure.instanceName, failure.message), {
          description: messages.lists.toasts.syncHint,
        });
      });
    },
    [messages.lists.toasts.instanceFailure, messages.lists.toasts.syncHint],
  );

  const runRefresh = async () => {
    setBusyAction("refresh");

    try {
      await refreshLists();
    } finally {
      setBusyAction(null);
    }
  };

  const changePageSize = async (nextPageSize: number) => {
    setBusyAction("page-size");

    try {
      await refreshLists(1, nextPageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const goToPage = async (page: number) => {
    setBusyAction("page");

    try {
      await refreshLists(page, data.pagination.pageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSort = async (field: ListsSortField) => {
    const nextSortDirection =
      sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : getDefaultListsSortDirection(field);

    setBusyAction("sort");

    try {
      const nextData = await refreshLists(1, data.pagination.pageSize, field, nextSortDirection);

      if (!nextData) {
        return;
      }

      setSortBy(field);
      setSortDirection(nextSortDirection);
    } finally {
      setBusyAction(null);
    }
  };

  const submitCreate = async (type: "allow" | "block") => {
    if (!newUrl.trim()) {
      return;
    }

    setBusyAction(`create:${type}`);
    const { data: responseData, response } = await client.POST<ListsMutationResponse>("/lists", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        address: newUrl.trim(),
        comment: newComment.trim() || messages.lists.defaultComment,
        type,
        groups: newGroupIds,
        enabled: true,
      },
    });

    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: messages.lists.toasts.createSuccess,
      partialMessage: messages.lists.toasts.updatePartial,
    });
    setNewUrl("");
    setNewComment("");
    setNewGroupIds([0]);
    await refreshLists();
  };

  const toggleListStatus = async (list: ListItem, enabled: boolean) => {
    const key = getListKey(list);
    setBusyAction(`toggle:${key}`);

    const { data: responseData, response } = await client.PUT<ListsMutationResponse>("/lists/{type}/{address}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: {
          type: list.type,
          address: list.address,
        },
      },
      body: {
        comment: list.comment,
        groups: list.groups,
        enabled,
      },
    });

    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: enabled ? messages.lists.toasts.enabledSuccess : messages.lists.toasts.disabledSuccess,
      partialMessage: messages.lists.toasts.updatePartial,
    });
    await refreshLists();
  };

  const saveGroupsAndComment = async (list: ListItem, groupIds: number[], comment: string | null) => {
    const key = getListKey(list);
    setBusyAction(`edit:${key}`);

    const { data: responseData, response } = await client.PUT<ListsMutationResponse>("/lists/{type}/{address}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: {
          type: list.type,
          address: list.address,
        },
      },
      body: {
        comment,
        groups: groupIds,
        enabled: list.enabled,
      },
    });

    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    notifyMutationResult(responseData, {
      successMessage: messages.lists.toasts.updateSuccess,
      partialMessage: messages.lists.toasts.updatePartial,
    });
    await refreshLists();
  };

  const executeDelete = async (itemsToDelete: { item: string; type: "allow" | "block" }[]) => {
    setBusyAction("delete");
    const { data: responseData, response } = await client.POST<ListsMutationResponse>("/lists/batchDelete", {
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
      successMessage: messages.lists.toasts.deleteSuccess,
      partialMessage: messages.lists.toasts.updatePartial,
    });
    await refreshLists();
  };

  const requestDelete = (itemsToDelete: { item: string; type: "allow" | "block" }[]) => {
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
          ? messages.lists.delete.titleSingle(firstItem.item)
          : messages.lists.delete.titleBatch(itemsToDelete.length),
      description:
        itemsToDelete.length === 1
          ? messages.lists.delete.descriptionSingle(firstItem.item)
          : messages.lists.delete.descriptionBatch(itemsToDelete.length),
    });
  };

  const openSyncDialog = (item: ListItem) => {
    if (isMutating) {
      return;
    }

    setSyncList(item);
    setSyncSourceInstanceId(item.origin.instanceId);
    setSyncTargetInstanceIds(buildDefaultSyncTargetIds(item, data.source.baselineInstanceId, item.origin.instanceId));
  };

  const closeSyncDialog = () => {
    if (syncList && busyAction === `sync:${getListKey(syncList)}`) {
      return;
    }

    setSyncList(null);
    setSyncSourceInstanceId("");
    setSyncTargetInstanceIds([]);
  };

  const runBulkSync = async () => {
    setBusyAction("sync:all");
    const { data: responseData, response } = await client.POST<ListsMutationResponse>("/lists/sync", {
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
      successMessage: messages.lists.toasts.syncSuccess,
      partialMessage: messages.lists.toasts.partialWarning,
    });
    await refreshLists();
  };

  const syncSingleList = async () => {
    if (!syncList) {
      return;
    }

    if (syncTargetInstanceIds.length === 0) {
      toast.error(messages.lists.syncDialog.targetsRequired);
      return;
    }

    setBusyAction(`sync:${getListKey(syncList)}`);
    const { data: responseData, response } = await client.POST<ListsMutationResponse>("/lists/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        address: syncList.address,
        type: syncList.type,
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
      successMessage: messages.lists.toasts.syncItemSuccess(syncList.address),
      partialMessage: messages.lists.toasts.partialWarning,
    });
    closeSyncDialog();
    await refreshLists();
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(data.items.map((item) => getListKey(item)));
      return;
    }

    setSelectedKeys([]);
  };

  const toggleSelectRow = (list: ListItem, checked: boolean) => {
    const key = getListKey(list);
    setSelectedKeys((current) => (checked ? [...new Set([...current, key])] : current.filter((item) => item !== key)));
  };

  const renderSortIcon = (field: ListsSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="size-3.5" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{messages.common.add}</CardTitle>
          <CardDescription>{messages.lists.create.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-list-url">{messages.lists.create.addressLabel}</FieldLabel>
              <Input
                id="new-list-url"
                placeholder="https://example.com/list.txt"
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-list-comment">{messages.lists.create.commentLabel}</FieldLabel>
              <Input
                id="new-list-comment"
                placeholder="..."
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel>{messages.lists.create.groupLabel}</FieldLabel>
              <CreateListGroupSelector
                groups={groups}
                selectedGroupIds={newGroupIds}
                onChange={setNewGroupIds}
                disabled={isMutating}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => void submitCreate("allow")}
                disabled={isMutating || !newUrl.trim()}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 lg:w-auto"
              >
                {busyAction === "create:allow" ? messages.lists.create.submitLoading : messages.lists.table.addAllow}
              </Button>
              <Button
                onClick={() => void submitCreate("block")}
                disabled={isMutating || !newUrl.trim()}
                variant="destructive"
                className="w-full lg:w-auto"
              >
                {busyAction === "create:block" ? messages.lists.create.submitLoading : messages.lists.table.addBlock}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{messages.lists.table.title}</CardTitle>
            <CardDescription>{messages.lists.table.description(data.source.baselineInstanceName)}</CardDescription>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ManagedItemsSearchInput
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder={messages.lists.table.searchPlaceholder}
              clearLabel={messages.lists.table.searchClear}
              disabled={busyAction !== null && busyAction !== "search"}
            />
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void runRefresh()}>
              <RefreshCw className={cn(busyAction === "refresh" ? "animate-spin" : undefined)} />
              {busyAction === "refresh" ? messages.lists.table.refreshLoading : messages.lists.table.refresh}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => setIsBulkSyncDialogOpen(true)}
            >
              <ArrowLeftRight className={cn(busyAction === "sync:all" ? "animate-pulse" : undefined)} />
              {busyAction === "sync:all" ? messages.lists.table.syncLoading : messages.lists.table.sync}
            </Button>
            {selectedItems.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() => requestDelete(selectedItems.map((item) => ({ item: item.address, type: item.type })))}
              >
                {messages.lists.table.deleteSelected(selectedItems.length)}
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.lists.table.sync}
              description={messages.lists.alerts.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}

          {data.items.length === 0 && !isReloading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <List />
                </EmptyMedia>
                <EmptyTitle>{messages.lists.table.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.lists.table.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ManagedItemsPagination
                changePageSize={(nextPageSize) => void changePageSize(nextPageSize)}
                goToPage={(page) => void goToPage(page)}
                isReloading={isReloading}
                nextLabel={messages.lists.table.next}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                previousLabel={messages.lists.table.previous}
                rowsPerPageLabel={messages.lists.table.rowsPerPage}
                showingLabel={messages.lists.table.showing}
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
                          aria-label={messages.lists.table.selectAll}
                        />
                      </TableHead>
                      <TableHead
                        aria-sort={
                          sortBy === "address" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 font-medium"
                          disabled={isMutating}
                          onClick={() => void toggleSort("address")}
                        >
                          {messages.lists.table.address}
                          {renderSortIcon("address")}
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
                          {messages.lists.table.type}
                          {renderSortIcon("type")}
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
                          {messages.lists.table.status}
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
                          {messages.lists.table.comment}
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
                          {messages.lists.table.group}
                          {renderSortIcon("group")}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">{messages.lists.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isReloading ? (
                      <ManagedItemsTableSkeleton columnCount={7} />
                    ) : (
                      data.items.map((item) => {
                        const rowKey = getListKey(item);

                        return (
                          <TableRow key={rowKey}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedKeySet.has(rowKey)}
                                onCheckedChange={(checked) => toggleSelectRow(item, checked === true)}
                                disabled={isMutating}
                                aria-label={messages.lists.table.selectRow(item.address)}
                              />
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-medium" title={item.address}>
                                  {item.address}
                                </span>
                                {item.sync.missingInstances.length > 0 ? (
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    className="h-4 w-4 text-amber-600 hover:text-amber-700"
                                    disabled={isMutating}
                                    aria-label={messages.lists.table.syncIssueAction(item.address)}
                                    title={messages.lists.table.syncIssueAction(item.address)}
                                    onClick={() => openSyncDialog(item)}
                                  >
                                    <CircleAlert className="h-3 w-3" />
                                  </Button>
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
                              <ListStatusToggle
                                checked={item.enabled}
                                disabled={isMutating}
                                activeLabel={
                                  busyAction === `toggle:${rowKey}` && item.enabled
                                    ? messages.lists.status.disabling
                                    : messages.lists.status.enabled
                                }
                                inactiveLabel={
                                  busyAction === `toggle:${rowKey}` && !item.enabled
                                    ? messages.lists.status.enabling
                                    : messages.lists.status.disabled
                                }
                                onCheckedChange={(checked) => void toggleListStatus(item, checked)}
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
                              <ListGroupEditor
                                list={item}
                                groups={groups}
                                disabled={isMutating}
                                onSave={(groupIds) => saveGroupsAndComment(item, groupIds, item.comment)}
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
                                  <DropdownMenuItem className="gap-2" onClick={() => setEditingList(item)}>
                                    <Info className="h-4 w-4" />
                                    {messages.lists.table.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-2 text-destructive focus:text-destructive"
                                    onClick={() => requestDelete([{ item: item.address, type: item.type }])}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {messages.lists.table.delete}
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
                nextLabel={messages.lists.table.next}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                previousLabel={messages.lists.table.previous}
                rowsPerPageLabel={messages.lists.table.rowsPerPage}
                showingLabel={messages.lists.table.showing}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
              />
            </>
          )}
        </CardContent>
      </Card>

      {editingList ? (
        <ListEditDialog
          list={editingList}
          groups={groups}
          open={editingList !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingList(null);
            }
          }}
          onSave={(groupIds, comment) => saveGroupsAndComment(editingList, groupIds, comment)}
          disabled={isMutating}
        />
      ) : null}

      <Dialog open={syncList !== null} onOpenChange={(open) => (!open ? closeSyncDialog() : undefined)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {syncList ? messages.lists.syncDialog.titleSingle(syncList.address) : messages.lists.syncDialog.titleAll}
            </DialogTitle>
            <DialogDescription>
              {syncList
                ? messages.lists.syncDialog.descriptionSingle(syncList.address)
                : messages.lists.syncDialog.descriptionAll(data.source.baselineInstanceName)}
            </DialogDescription>
          </DialogHeader>

          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.lists.table.sync}
              description={messages.lists.syncDialog.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}

          {syncList ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{syncList.address}</p>
                  <Badge variant="outline" className="uppercase">
                    {syncList.type}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground text-sm">
                  {messages.lists.syncDialog.availabilityHint(
                    syncList.sync.sourceInstances.length,
                    syncList.sync.missingInstances.length,
                  )}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel>{messages.lists.syncDialog.sourceLabel}</FieldLabel>
                  <Select
                    value={syncSourceInstanceId}
                    onValueChange={(value) => {
                      setSyncSourceInstanceId(value);

                      if (syncList) {
                        setSyncTargetInstanceIds(
                          buildDefaultSyncTargetIds(syncList, data.source.baselineInstanceId, value),
                        );
                      }
                    }}
                    disabled={isMutating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={messages.lists.syncDialog.sourcePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {syncInstanceStates.map((instance) => (
                        <SelectItem key={instance.instanceId} value={instance.instanceId}>
                          {instance.instanceName} ·{" "}
                          {instance.hasList
                            ? messages.lists.syncDialog.instanceHasItem
                            : messages.lists.syncDialog.instanceMissingItem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="space-y-2">
                  <FieldLabel>{messages.lists.syncDialog.targetsLabel}</FieldLabel>
                  {syncTargetStates.length > 0 ? (
                    <div className="grid gap-2">
                      {syncTargetStates.map((instance) => (
                        <div
                          key={instance.instanceId}
                          className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            id={`sync-list-${syncList.address}-${instance.instanceId}`}
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
                            htmlFor={`sync-list-${syncList.address}-${instance.instanceId}`}
                            className="flex-1 cursor-pointer"
                          >
                            {instance.instanceName}
                          </label>
                          <Badge variant="outline">
                            {instance.hasList
                              ? messages.lists.syncDialog.instanceHasItem
                              : messages.lists.syncDialog.instanceMissingItem}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">{messages.lists.syncDialog.noTargets}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" disabled={isMutating} onClick={closeSyncDialog}>
              {messages.lists.syncDialog.close}
            </Button>
            <Button disabled={isMutating || syncTargetInstanceIds.length === 0} onClick={() => void syncSingleList()}>
              <ArrowLeftRight
                className={cn("mr-2 h-4 w-4", busyAction?.startsWith("sync:") ? "animate-spin" : undefined)}
              />
              {busyAction?.startsWith("sync:")
                ? messages.lists.syncDialog.syncLoading
                : messages.lists.syncDialog.syncAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBulkSyncDialogOpen} onOpenChange={setIsBulkSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.lists.syncDialog.bulkTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.lists.syncDialog.bulkDescription(data.source.baselineInstanceName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {data.source.unavailableInstanceCount > 0 ? (
            <ManagedItemsPartialAlert
              title={messages.lists.table.sync}
              description={messages.lists.syncDialog.partialAvailability(
                data.source.availableInstanceCount,
                data.source.totalInstances,
              )}
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.lists.syncDialog.close}</AlertDialogCancel>
            <Button disabled={isMutating} onClick={() => void runBulkSync()}>
              {busyAction === "sync:all"
                ? messages.lists.syncDialog.syncLoading
                : messages.lists.syncDialog.confirmBulk}
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
            <p className="text-rose-600 text-sm">{messages.lists.delete.irreversible}</p>
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                id="lists-delete-skip-confirm"
                checked={rememberDeleteChoice}
                onCheckedChange={(checked) => setRememberDeleteChoice(checked === true)}
                disabled={isMutating}
              />
              <label htmlFor="lists-delete-skip-confirm">{messages.lists.delete.dontAskAgain}</label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.lists.delete.cancel}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isMutating}
              onClick={() => {
                if (!deleteDialog) {
                  return;
                }

                if (rememberDeleteChoice) {
                  setClientCookie(
                    FRONTEND_CONFIG.lists.deleteConfirmCookieKey,
                    "1",
                    FRONTEND_CONFIG.lists.deleteConfirmCookieDays,
                  );
                  setSkipDeleteConfirm(true);
                }

                void executeDelete(deleteDialog.items);
              }}
            >
              {isMutating
                ? messages.lists.delete.confirmLoading
                : deleteDialog && deleteDialog.items.length > 1
                  ? messages.lists.delete.confirmBatch(deleteDialog.items.length)
                  : messages.lists.delete.confirmSingle}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
