"use client";

import { useEffect, useMemo, useState } from "react";

import { ArrowLeftRight, CircleAlert, Info, List, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import type { GroupItem, ListItem, ListsListResponse, ListsMutationResponse } from "@/lib/api/yapd-types";
import { getClientCookie, setClientCookie } from "@/lib/cookie.client";
import { useWebI18n } from "@/lib/i18n/client";
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

type SyncSelectionState = Record<
  string,
  {
    sourceInstanceId: string;
    targetInstanceIds: string[];
  }
>;

type ListSyncInstanceState = {
  instanceId: string;
  instanceName: string;
  hasList: boolean;
};

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

function buildSyncSelections(items: ListItem[], baselineInstanceId: string): SyncSelectionState {
  return Object.fromEntries(
    items
      .filter((item) => item.sync.missingInstances.length > 0)
      .map((item) => [
        `${item.address}-${item.type}`,
        {
          sourceInstanceId: item.origin.instanceId,
          targetInstanceIds: buildDefaultSyncTargetIds(item, baselineInstanceId, item.origin.instanceId),
        },
      ]),
  );
}

export function ListsWorkspace({
  initialItems,
  initialSource,
  groups,
}: Readonly<{
  initialItems: ListItem[];
  initialSource: ListsListResponse["source"];
  groups: GroupItem[];
}>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const [items, setItems] = useState(initialItems);
  const [source, setSource] = useState(initialSource);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Creation form state
  const [newUrl, setNewUrl] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([0]);

  // Edit state
  const [editingList, setEditingList] = useState<ListItem | null>(null);

  // Sync state
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncDialogAddress, setSyncDialogAddress] = useState<string | null>(null);
  const [syncDialogType, setSyncDialogType] = useState<"allow" | "block" | null>(null);
  const [syncSelections, setSyncSelections] = useState<SyncSelectionState>(() =>
    buildSyncSelections(initialItems, initialSource.baselineInstanceId),
  );

  // Delete state
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);

  useEffect(() => {
    setSkipDeleteConfirm(getClientCookie(FRONTEND_CONFIG.groups.deleteConfirmCookieKey) === "1");
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchDraft.trim().toLowerCase());
    }, FRONTEND_CONFIG.groups.searchDebounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchDraft]);

  const filteredItems = useMemo(() => {
    if (searchTerm.length === 0) {
      return items;
    }

    return items.filter(
      (item) =>
        item.address.toLowerCase().includes(searchTerm) || (item.comment?.toLowerCase().includes(searchTerm) ?? false),
    );
  }, [items, searchTerm]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedKeySet.has(`${item.address}-${item.type}`));
  const someVisibleSelected = filteredItems.some((item) => selectedKeySet.has(`${item.address}-${item.type}`));
  const isMutating = busyAction !== null;

  const refreshLists = async () => {
    const { data, response } = await client.GET<ListsListResponse>("/lists");

    if (!response.ok || !data) {
      toast.error(messages.lists.toasts.loadFailed);
      return null;
    }

    setItems(data.items);
    setSource(data.source);
    return data;
  };

  const runRefresh = async () => {
    setBusyAction("refresh");
    try {
      await refreshLists();
    } finally {
      setBusyAction(null);
    }
  };

  const submitCreate = async (type: "allow" | "block") => {
    if (!newUrl.trim()) return;

    setBusyAction(`create:${type}`);
    const { data, response } = await client.POST<ListsMutationResponse>("/lists", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        address: newUrl.trim(),
        comment: newComment.trim() || null,
        type,
        groups: newGroupIds,
        enabled: true,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setNewUrl("");
    setNewComment("");
    setNewGroupIds([0]);

    if (data.status === "partial") {
      toast.warning(messages.lists.toasts.updatePartial(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.lists.toasts.updateSuccess);
    }

    await refreshLists();
  };

  const toggleListStatus = async (list: ListItem, enabled: boolean) => {
    setBusyAction(`toggle:${list.address}-${list.type}`);

    const { data, response } = await client.PUT<ListsMutationResponse>("/lists/{address}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: { address: list.address },
        query: { type: list.type },
      },
      body: {
        comment: list.comment,
        type: list.type,
        groups: list.groups,
        enabled,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    if (data.status === "partial") {
      toast.warning(messages.lists.toasts.updatePartial(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.lists.toasts.updateSuccess);
    }

    await refreshLists();
  };

  const saveGroupsAndComment = async (list: ListItem, groupIds: number[], comment: string | null) => {
    setBusyAction(`edit:${list.address}-${list.type}`);

    const { data, response } = await client.PUT<ListsMutationResponse>("/lists/{address}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: { address: list.address },
        query: { type: list.type },
      },
      body: {
        comment,
        type: list.type,
        groups: groupIds,
        enabled: list.enabled,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    if (data.status === "partial") {
      toast.warning(messages.lists.toasts.updatePartial(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.lists.toasts.updateSuccess);
    }

    await refreshLists();
  };

  const executeDelete = async (itemsToDelete: { item: string; type: "allow" | "block" }[]) => {
    setBusyAction("delete");
    const { data, response } = await client.POST<ListsMutationResponse>("/lists/batchDelete", {
      headers: { "x-yapd-csrf": csrfToken },
      body: { items: itemsToDelete },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setDeleteDialog(null);
    setSelectedKeys([]);

    if (data.status === "partial") {
      toast.warning(messages.lists.toasts.updatePartial(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.groups.toasts.deleteSuccess);
    }

    await refreshLists();
  };

  const requestDelete = (itemsToDelete: { item: string; type: "allow" | "block" }[]) => {
    if (isMutating) return;

    if (skipDeleteConfirm) {
      void executeDelete(itemsToDelete);
      return;
    }

    const firstItem = itemsToDelete[0];
    if (!firstItem) return;

    setDeleteDialog({
      items: itemsToDelete,
      title:
        itemsToDelete.length === 1
          ? messages.groups.delete.titleSingle(firstItem.item)
          : messages.groups.delete.titleBatch(itemsToDelete.length),
      description:
        itemsToDelete.length === 1
          ? messages.groups.delete.descriptionSingle(firstItem.item)
          : messages.groups.delete.descriptionBatch(itemsToDelete.length),
    });
  };

  const openSyncDialog = (address?: string, type?: "allow" | "block") => {
    setSyncDialogAddress(address ?? null);
    setSyncDialogType(type ?? null);
    setSyncSelections(buildSyncSelections(items, source.baselineInstanceId));
    setIsSyncDialogOpen(true);
  };

  const runBulkSync = async () => {
    setBusyAction("sync:all");
    const { data, response } = await client.POST<ListsMutationResponse>("/lists/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {}, // Bulk sync N-to-N
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    if (data.status === "partial") {
      toast.warning(messages.groups.toasts.partialWarning(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.groups.toasts.syncSuccess);
    }

    await refreshLists();
  };

  const updateSyncSource = (address: string, type: "allow" | "block", sourceInstanceId: string) => {
    const key = `${address}-${type}`;
    const item = items.find((i) => i.address === address && i.type === type);
    setSyncSelections((current) => ({
      ...current,
      [key]: {
        sourceInstanceId,
        targetInstanceIds: item ? buildDefaultSyncTargetIds(item, source.baselineInstanceId, sourceInstanceId) : [],
      },
    }));
  };

  const toggleSyncTarget = (address: string, type: "allow" | "block", targetInstanceId: string, checked: boolean) => {
    const key = `${address}-${type}`;
    setSyncSelections((current) => {
      const previous = current[key];
      const nextTargetIds = checked
        ? [...new Set([...(previous?.targetInstanceIds ?? []), targetInstanceId])]
        : (previous?.targetInstanceIds ?? []).filter((id) => id !== targetInstanceId);

      return {
        ...current,
        [key]: {
          sourceInstanceId:
            previous?.sourceInstanceId ??
            items.find((i) => i.address === address && i.type === type)?.origin.instanceId ??
            "",
          targetInstanceIds: nextTargetIds,
        },
      };
    });
  };

  const syncSingleList = async (item: ListItem) => {
    const key = `${item.address}-${item.type}`;
    const selection = syncSelections[key] ?? {
      sourceInstanceId: item.origin.instanceId,
      targetInstanceIds: buildDefaultSyncTargetIds(item, source.baselineInstanceId, item.origin.instanceId),
    };

    if (selection.targetInstanceIds.length === 0) {
      toast.error(messages.groups.syncDialog.targetsRequired);
      return;
    }

    setBusyAction(`sync:${key}`);
    const { data, response } = await client.POST<ListsMutationResponse>("/lists/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        address: item.address,
        type: item.type,
        sourceInstanceId: selection.sourceInstanceId,
        targetInstanceIds: selection.targetInstanceIds,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(messages.groups.toasts.syncGroupSuccess(item.address));
    const refreshed = await refreshLists();
    if (refreshed) {
      const nextUnsynced = refreshed.items.filter((i) => i.sync.missingInstances.length > 0);
      const stillUnsynced = syncDialogAddress
        ? nextUnsynced.some((i) => i.address === syncDialogAddress && i.type === syncDialogType)
        : nextUnsynced.length > 0;

      if (!stillUnsynced) {
        setIsSyncDialogOpen(false);
      }
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(filteredItems.map((item) => `${item.address}-${item.type}`));
    } else {
      setSelectedKeys([]);
    }
  };

  const toggleSelectRow = (address: string, type: string, checked: boolean) => {
    const key = `${address}-${type}`;
    setSelectedKeys((current) => (checked ? [...new Set([...current, key])] : current.filter((k) => k !== key)));
  };

  const unsyncedItems = useMemo(() => items.filter((item) => item.sync.missingInstances.length > 0), [items]);
  const syncDialogItems = useMemo(
    () =>
      syncDialogAddress
        ? unsyncedItems.filter((i) => i.address === syncDialogAddress && i.type === syncDialogType)
        : unsyncedItems,
    [syncDialogAddress, syncDialogType, unsyncedItems],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{messages.common.add}</CardTitle>
          <CardDescription>{messages.lists.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-list-url">URL</FieldLabel>
              <Input
                id="new-list-url"
                placeholder="https://example.com/list.txt"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-list-comment">{messages.lists.table.comment}</FieldLabel>
              <Input
                id="new-list-comment"
                placeholder="..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel>{messages.lists.table.group}</FieldLabel>
              <CreateListGroupSelector
                groups={groups}
                selectedGroupIds={newGroupIds}
                onChange={setNewGroupIds}
                disabled={isMutating}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => submitCreate("allow")}
                disabled={isMutating || !newUrl.trim()}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 lg:w-auto"
              >
                {busyAction === "create:allow" ? messages.groups.create.submitLoading : messages.lists.table.addAllow}
              </Button>
              <Button
                onClick={() => submitCreate("block")}
                disabled={isMutating || !newUrl.trim()}
                variant="destructive"
                className="w-full lg:w-auto"
              >
                {busyAction === "create:block" ? messages.groups.create.submitLoading : messages.lists.table.addBlock}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>
              {items.length} {messages.lists.title}
            </CardTitle>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={messages.lists.table.searchPlaceholder}
              disabled={isMutating}
              className="min-w-64"
            />
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void runRefresh()}>
              <RefreshCw className={cn(busyAction === "refresh" ? "animate-spin" : undefined)} />
              {busyAction === "refresh" ? messages.common.retry : messages.sidebar.sync.refresh}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => openSyncDialog()}>
              <ArrowLeftRight />
              {messages.groups.table.sync}
            </Button>
            {selectedKeys.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() =>
                  requestDelete(
                    items
                      .filter((i) => selectedKeySet.has(`${i.address}-${i.type}`))
                      .map((i) => ({ item: i.address, type: i.type })),
                  )
                }
              >
                {messages.groups.table.deleteSelected(selectedKeys.length)}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
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
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        disabled={isMutating}
                      />
                    </TableHead>
                    <TableHead>{messages.lists.table.address}</TableHead>
                    <TableHead className="text-center">{messages.lists.table.status}</TableHead>
                    <TableHead>{messages.lists.table.comment}</TableHead>
                    <TableHead>{messages.lists.table.group}</TableHead>
                    <TableHead className="text-right">{messages.lists.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={`${item.address}-${item.type}`}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedKeySet.has(`${item.address}-${item.type}`)}
                          onCheckedChange={(checked) => toggleSelectRow(item.address, item.type, checked === true)}
                          disabled={isMutating}
                        />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="flex flex-col gap-1">
                          <span className="truncate font-medium" title={item.address}>
                            {item.address}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase",
                                item.type === "allow"
                                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                                  : "border-rose-500 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {item.type}
                            </Badge>
                            {item.sync.isFullySynced ? (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              >
                                Synced
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              >
                                Drift
                              </Badge>
                            )}
                            {!item.sync.isFullySynced && (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="h-4 w-4 text-amber-600 hover:text-amber-700"
                                onClick={() => openSyncDialog(item.address, item.type)}
                              >
                                <CircleAlert className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <ListStatusToggle
                          checked={item.enabled}
                          disabled={isMutating}
                          activeLabel={
                            busyAction === `toggle:${item.address}-${item.type}` && item.enabled
                              ? messages.lists.status.disabling
                              : messages.lists.status.enabled
                          }
                          inactiveLabel={
                            busyAction === `toggle:${item.address}-${item.type}` && !item.enabled
                              ? messages.lists.status.enabling
                              : messages.lists.status.disabled
                          }
                          onCheckedChange={(checked) => void toggleListStatus(item, checked)}
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className={cn("truncate text-sm", !item.comment && "text-muted-foreground")}>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingList && (
        <ListEditDialog
          list={editingList}
          groups={groups}
          open={editingList !== null}
          onOpenChange={(open) => !open && setEditingList(null)}
          onSave={(groupIds, comment) => saveGroupsAndComment(editingList, groupIds, comment)}
          disabled={isMutating}
        />
      )}

      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {syncDialogAddress
                ? messages.groups.syncDialog.titleSingle(syncDialogAddress)
                : messages.groups.syncDialog.titleAll}
            </DialogTitle>
            <DialogDescription>
              {syncDialogAddress
                ? messages.groups.syncDialog.descriptionSingle(syncDialogAddress)
                : messages.groups.syncDialog.descriptionAll(source.baselineInstanceName)}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {syncDialogItems.map((item) => {
              const key = `${item.address}-${item.type}`;
              const instanceStates = getListSyncInstanceStates(item, source.baselineInstanceId);
              const selection = syncSelections[key] || {
                sourceInstanceId: item.origin.instanceId,
                targetInstanceIds: buildDefaultSyncTargetIds(item, source.baselineInstanceId, item.origin.instanceId),
              };
              const targetStates = instanceStates.filter((inst) => inst.instanceId !== selection.sourceInstanceId);
              const isSyncing = busyAction === `sync:${key}`;

              return (
                <Card key={key} size="sm" className="border py-4 shadow-none">
                  <CardHeader className="gap-3">
                    <CardTitle className="truncate text-sm">
                      {item.address} ({item.type})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field className="gap-2">
                        <FieldLabel>{messages.groups.syncDialog.sourceLabel}</FieldLabel>
                        <Select
                          value={selection.sourceInstanceId}
                          onValueChange={(val) => updateSyncSource(item.address, item.type, val)}
                          disabled={isMutating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {instanceStates.map((inst) => (
                              <SelectItem key={inst.instanceId} value={inst.instanceId}>
                                {inst.instanceName} ·{" "}
                                {inst.hasList
                                  ? messages.groups.syncDialog.instanceHasGroup
                                  : messages.groups.syncDialog.instanceMissingGroup}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <div className="space-y-2">
                        <p className="font-medium text-sm">{messages.groups.syncDialog.targetsLabel}</p>
                        <div className="grid gap-2">
                          {targetStates.map((inst) => (
                            <div key={inst.instanceId} className="flex items-center gap-2 rounded-md border p-2">
                              <Checkbox
                                id={`sync-${key}-${inst.instanceId}`}
                                checked={selection.targetInstanceIds.includes(inst.instanceId)}
                                onCheckedChange={(checked) =>
                                  toggleSyncTarget(item.address, item.type, inst.instanceId, checked === true)
                                }
                                disabled={isMutating}
                              />
                              <label htmlFor={`sync-${key}-${inst.instanceId}`} className="text-xs">
                                {inst.instanceName} ({inst.hasList ? "Has it" : "Missing"})
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => syncSingleList(item)}
                        disabled={isMutating || selection.targetInstanceIds.length === 0}
                      >
                        <ArrowLeftRight className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                        {isSyncing ? messages.groups.syncDialog.syncLoading : messages.groups.syncDialog.syncAction}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DialogFooter className="flex w-full items-center justify-between sm:justify-between">
            {!syncDialogAddress && unsyncedItems.length > 0 && (
              <Button variant="default" onClick={runBulkSync} disabled={isMutating}>
                <ArrowLeftRight className={cn("mr-2 h-4 w-4", busyAction === "sync:all" && "animate-spin")} />
                {busyAction === "sync:all"
                  ? messages.groups.syncDialog.syncLoading
                  : `${messages.groups.table.sync} All`}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)} disabled={isMutating}>
              {messages.sidebar.sync.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && !isMutating && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <p className="text-rose-600 text-sm">{messages.groups.delete.irreversible}</p>
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                id="lists-delete-skip-confirm"
                checked={rememberDeleteChoice}
                onCheckedChange={(checked) => setRememberDeleteChoice(checked === true)}
                disabled={isMutating}
              />
              <label htmlFor="lists-delete-skip-confirm">{messages.groups.delete.dontAskAgain}</label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.groups.delete.cancel}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isMutating}
              onClick={() => {
                if (deleteDialog) {
                  if (rememberDeleteChoice) {
                    setClientCookie(
                      FRONTEND_CONFIG.groups.deleteConfirmCookieKey,
                      "1",
                      FRONTEND_CONFIG.groups.deleteConfirmCookieDays,
                    );
                    setSkipDeleteConfirm(true);
                  }
                  executeDelete(deleteDialog.items);
                }
              }}
            >
              {isMutating ? messages.groups.delete.confirmLoading : messages.groups.delete.confirmSingle}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
