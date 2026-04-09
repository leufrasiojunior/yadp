"use client";

import { useEffect, useMemo, useState } from "react";

import { ArrowLeftRight, CircleAlert, Globe, Info, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
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
import type {
  DomainItem,
  DomainOperationResponse,
  DomainsListResponse,
  DomainsMutationResponse,
  GroupItem,
} from "@/lib/api/yapd-types";
import { getClientCookie, setClientCookie } from "@/lib/cookie.client";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { CreateDomainGroupSelector } from "./create-domain-group-selector";
import { DomainEditDialog } from "./domain-edit-dialog";
import { DomainGroupEditor } from "./domain-group-editor";
import { DomainStatusToggle } from "./domain-status-toggle";

type DeleteDialogState = {
  items: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[];
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

type DomainSyncInstanceState = {
  instanceId: string;
  instanceName: string;
  hasDomain: boolean;
};

type DomainFilterType = "exact-allow" | "regex-allow" | "exact-deny" | "regex-deny";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function sortSyncInstanceStates(states: DomainSyncInstanceState[], baselineInstanceId: string) {
  return [...states].sort((left, right) => {
    if (left.instanceId === baselineInstanceId && right.instanceId !== baselineInstanceId) return -1;
    if (left.instanceId !== baselineInstanceId && right.instanceId === baselineInstanceId) return 1;
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
    (i) => i.instanceId === sourceInstanceId,
  );
  if (!sourceState) return [];
  return getDomainSyncInstanceStates(item, baselineInstanceId)
    .filter((i) => i.instanceId !== sourceInstanceId && i.hasDomain !== sourceState.hasDomain)
    .map((i) => i.instanceId);
}

function buildSyncSelections(items: DomainItem[], baselineInstanceId: string): SyncSelectionState {
  return Object.fromEntries(
    items
      .filter((i) => i.sync.missingInstances.length > 0)
      .map((i) => [
        `${i.domain}-${i.type}-${i.kind}`,
        {
          sourceInstanceId: i.origin.instanceId,
          targetInstanceIds: buildDefaultSyncTargetIds(i, baselineInstanceId, i.origin.instanceId),
        },
      ]),
  );
}

export function DomainsWorkspace({
  initialItems,
  initialSource,
  groups,
}: Readonly<{
  initialItems: DomainItem[];
  initialSource: DomainsListResponse["source"];
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
  const [newDomain, setNewDomain] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([0]);
  const [newKind, setNewKind] = useState<"exact" | "regex_specific" | "regex_any">("exact");

  // Filtering state
  const [activeFilters, setActiveFilters] = useState<DomainFilterType[]>([
    "exact-allow",
    "regex-allow",
    "exact-deny",
    "regex-deny",
  ]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit state
  const [editingItem, setEditingItem] = useState<DomainItem | null>(null);

  // Sync state
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncDialogAddress, setSyncDialogAddress] = useState<string | null>(null);
  const [syncDialogType, setSyncDialogType] = useState<"allow" | "deny" | null>(null);
  const [syncDialogKind, setSyncDialogKind] = useState<"exact" | "regex" | null>(null);
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
      setPage(1); // Reset page on search
    }, FRONTEND_CONFIG.groups.searchDebounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter
    if (searchTerm.length > 0) {
      result = result.filter(
        (i) => i.domain.toLowerCase().includes(searchTerm) || (i.comment?.toLowerCase().includes(searchTerm) ?? false),
      );
    }

    // Checkbox filters
    result = result.filter((item) => {
      const typeKey = item.type === "deny" ? "deny" : "allow";
      const filterKey = `${item.kind}-${typeKey}` as DomainFilterType;
      return activeFilters.includes(filterKey);
    });

    return result;
  }, [items, searchTerm, activeFilters]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((i) => selectedKeySet.has(`${i.domain}-${i.type}-${i.kind}`));
  const someVisibleSelected = filteredItems.some((i) => selectedKeySet.has(`${i.domain}-${i.type}-${i.kind}`));
  const isMutating = busyAction !== null;

  const refreshDomains = async () => {
    const { data, response } = await client.GET<DomainsListResponse>("/domains");
    if (!response.ok || !data) {
      toast.error(messages.domains.toasts.loadFailed);
      return null;
    }
    setItems(data.items);
    setSource(data.source);
    return data;
  };

  const runRefresh = async () => {
    setBusyAction("refresh");
    try {
      await refreshDomains();
    } finally {
      setBusyAction(null);
    }
  };

  const submitCreate = async (type: "allow" | "deny") => {
    if (!newDomain.trim()) return;

    setBusyAction(`create:${type}`);

    let piholeKind: "exact" | "regex" = "exact";
    let finalComment = newComment.trim() || messages.common.defaultComment;

    if (newKind === "regex_specific") {
      piholeKind = "regex";
      finalComment = "Bloquear um nome exato com TLD específico";
    } else if (newKind === "regex_any") {
      piholeKind = "regex";
      finalComment = "Bloquear um nome exato com qualquer TLD";
    }

    const { data, response } = await client.POST<DomainOperationResponse>("/domains/{type}/{kind}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: { path: { type, kind: piholeKind } },
      body: {
        domain: newDomain.trim(),
        comment: finalComment,
        scope: "all",
        groups: newGroupIds,
      },
    });

    setBusyAction(null);
    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setNewDomain("");
    setNewComment("");
    setNewGroupIds([0]);
    setNewKind("exact");
    toast.success(messages.domains.toasts.updateSuccess);
    await refreshDomains();
  };

  const toggleStatus = async (item: DomainItem, enabled: boolean) => {
    const key = `${item.domain}-${item.type}-${item.kind}`;
    setBusyAction(`toggle:${key}`);
    const { data, response } = await client.PUT<DomainsMutationResponse>("/domains/{domain}/{type}/{kind}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: { domain: item.domain, type: item.type, kind: item.kind },
        query: { type: item.type },
      },
      body: { comment: item.comment, groups: item.groups, enabled },
    });
    setBusyAction(null);
    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }
    toast.success(messages.domains.toasts.updateSuccess);
    await refreshDomains();
  };

  const saveEdit = async (item: DomainItem, groupIds: number[], comment: string | null) => {
    const key = `${item.domain}-${item.type}-${item.kind}`;
    setBusyAction(`edit:${key}`);
    const { data, response } = await client.PUT<DomainsMutationResponse>("/domains/{domain}/{type}/{kind}", {
      headers: { "x-yapd-csrf": csrfToken },
      params: {
        path: { domain: item.domain, type: item.type, kind: item.kind },
        query: { type: item.type },
      },
      body: { comment, groups: groupIds, enabled: item.enabled },
    });
    setBusyAction(null);
    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }
    toast.success(messages.domains.toasts.updateSuccess);
    await refreshDomains();
  };

  const executeDelete = async (itemsToDelete: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[]) => {
    setBusyAction("delete");
    const { data, response } = await client.POST<DomainsMutationResponse>("/domains/batchDelete", {
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
    toast.success(messages.groups.toasts.deleteSuccess);
    await refreshDomains();
  };

  const requestDelete = (itemsToDelete: { item: string; type: "allow" | "deny"; kind: "exact" | "regex" }[]) => {
    if (isMutating || itemsToDelete.length === 0) return;
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

  const openSyncDialog = (item?: DomainItem) => {
    setSyncDialogAddress(item?.domain ?? null);
    setSyncDialogType(item?.type ?? null);
    setSyncDialogKind(item?.kind ?? null);
    setSyncSelections(buildSyncSelections(items, source.baselineInstanceId));
    setIsSyncDialogOpen(true);
  };

  const runBulkSync = async () => {
    setBusyAction("sync:all");
    const { data, response } = await client.POST<DomainsMutationResponse>("/domains/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {},
    });
    setBusyAction(null);
    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }
    toast.success(messages.groups.toasts.syncSuccess);
    await refreshDomains();
  };

  const syncSingle = async (item: DomainItem) => {
    const key = `${item.domain}-${item.type}-${item.kind}`;
    const selection = syncSelections[key] || {
      sourceInstanceId: item.origin.instanceId,
      targetInstanceIds: buildDefaultSyncTargetIds(item, source.baselineInstanceId, item.origin.instanceId),
    };
    if (selection.targetInstanceIds.length === 0) {
      toast.error(messages.groups.syncDialog.targetsRequired);
      return;
    }
    setBusyAction(`sync:${key}`);
    const { data, response } = await client.POST<DomainsMutationResponse>("/domains/sync", {
      headers: { "x-yapd-csrf": csrfToken },
      body: {
        domain: item.domain,
        type: item.type,
        kind: item.kind,
        sourceInstanceId: selection.sourceInstanceId,
        targetInstanceIds: selection.targetInstanceIds,
      },
    });
    setBusyAction(null);
    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }
    toast.success(messages.groups.toasts.syncGroupSuccess(item.domain));
    const refreshed = await refreshDomains();
    if (refreshed) {
      const stillUnsynced = syncDialogAddress
        ? refreshed.items.some(
            (i) =>
              i.domain === syncDialogAddress &&
              i.type === syncDialogType &&
              i.kind === syncDialogKind &&
              i.sync.missingInstances.length > 0,
          )
        : refreshed.items.some((i) => i.sync.missingInstances.length > 0);
      if (!stillUnsynced) setIsSyncDialogOpen(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(filteredItems.map((item) => `${item.domain}-${item.type}-${item.kind}`));
    } else {
      setSelectedKeys([]);
    }
  };

  const toggleSelectRow = (domain: string, type: string, kind: string, checked: boolean) => {
    const key = `${domain}-${type}-${kind}`;
    setSelectedKeys((current) => (checked ? [...new Set([...current, key])] : current.filter((k) => k !== key)));
  };

  const toggleFilter = (filter: DomainFilterType, checked: boolean) => {
    setActiveFilters((current) => (checked ? [...current, filter] : current.filter((f) => f !== filter)));
    setPage(1); // Reset page on filter change
  };

  const unsyncedItems = useMemo(() => items.filter((item) => item.sync.missingInstances.length > 0), [items]);
  const syncDialogItems = useMemo(
    () =>
      syncDialogAddress
        ? unsyncedItems.filter(
            (i) => i.domain === syncDialogAddress && i.type === syncDialogType && i.kind === syncDialogKind,
          )
        : unsyncedItems,
    [syncDialogAddress, syncDialogType, syncDialogKind, unsyncedItems],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{messages.common.add}</CardTitle>
          <CardDescription>{messages.domains.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="new-domain">{messages.domains.create.domainLabel}</FieldLabel>
              <Input
                id="new-domain"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={isMutating}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel>{messages.domains.create.kindLabel}</FieldLabel>
              <Select
                value={newKind}
                onValueChange={(val) => setNewKind(val as "exact" | "regex_specific" | "regex_any")}
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
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isMutating || newKind !== "exact"}
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
                onClick={() => submitCreate("allow")}
                disabled={isMutating || !newDomain.trim()}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 lg:w-auto"
              >
                {busyAction === "create:allow" ? messages.groups.create.submitLoading : messages.domains.table.addAllow}
              </Button>
              <Button
                onClick={() => submitCreate("deny")}
                disabled={isMutating || !newDomain.trim()}
                variant="destructive"
                className="w-full lg:w-auto"
              >
                {busyAction === "create:deny" ? messages.groups.create.submitLoading : messages.domains.table.addDeny}
              </Button>
            </div>
          </div>
          {newKind !== "exact" && (
            <p className="mt-2 text-muted-foreground text-xs italic">
              {newKind === "regex_specific"
                ? messages.domains.create.kinds.regexSpecific.description
                : messages.domains.create.kinds.regexAny.description}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <CardTitle>
              {items.length} {messages.domains.title}
            </CardTitle>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-exact-allow"
                  checked={activeFilters.includes("exact-allow")}
                  onCheckedChange={(c) => toggleFilter("exact-allow", c === true)}
                />
                <label htmlFor="filter-exact-allow" className="cursor-pointer font-medium text-xs">
                  {messages.domains.filters.exactAllow}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-regex-allow"
                  checked={activeFilters.includes("regex-allow")}
                  onCheckedChange={(c) => toggleFilter("regex-allow", c === true)}
                />
                <label htmlFor="filter-regex-allow" className="cursor-pointer font-medium text-xs">
                  {messages.domains.filters.regexAllow}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-exact-deny"
                  checked={activeFilters.includes("exact-deny")}
                  onCheckedChange={(c) => toggleFilter("exact-deny", c === true)}
                />
                <label htmlFor="filter-exact-deny" className="cursor-pointer font-medium text-xs">
                  {messages.domains.filters.exactDeny}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-regex-deny"
                  checked={activeFilters.includes("regex-deny")}
                  onCheckedChange={(c) => toggleFilter("regex-deny", c === true)}
                />
                <label htmlFor="filter-regex-deny" className="cursor-pointer font-medium text-xs">
                  {messages.domains.filters.regexDeny}
                </label>
              </div>
            </div>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={messages.domains.table.searchPlaceholder}
              disabled={isMutating}
              className="min-w-64"
            />
            <Button variant="outline" size="sm" onClick={runRefresh} disabled={isMutating}>
              <RefreshCw className={cn(busyAction === "refresh" && "animate-spin")} />
              {busyAction === "refresh" ? messages.common.retry : messages.sidebar.sync.refresh}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openSyncDialog()} disabled={isMutating}>
              <ArrowLeftRight />
              {messages.groups.table.sync}
            </Button>
            {selectedKeys.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  requestDelete(
                    items
                      .filter((i) => selectedKeySet.has(`${i.domain}-${i.type}-${i.kind}`))
                      .map((i) => ({
                        item: i.domain,
                        type: i.type as "allow" | "deny",
                        kind: i.kind as "exact" | "regex",
                      })),
                  )
                }
                disabled={isMutating}
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
                  <Globe />
                </EmptyMedia>
                <EmptyTitle>{messages.domains.table.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.domains.table.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border">
                <Table className="min-w-[800px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={(c) => toggleSelectAll(c === true)}
                          disabled={isMutating}
                        />
                      </TableHead>
                      <TableHead className="w-[30%]">{messages.domains.table.domain}</TableHead>
                      <TableHead className="w-32 text-center">Tipo</TableHead>
                      <TableHead className="w-32 text-center">{messages.domains.table.status}</TableHead>
                      <TableHead className="w-[20%]">{messages.domains.table.comment}</TableHead>
                      <TableHead className="w-[20%]">{messages.domains.table.group}</TableHead>
                      <TableHead className="w-24 text-right">{messages.domains.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      const key = `${item.domain}-${item.type}-${item.kind}`;
                      return (
                        <TableRow key={key} className="odd:bg-muted/50">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedKeySet.has(key)}
                              onCheckedChange={(c) => toggleSelectRow(item.domain, item.type, item.kind, c === true)}
                              disabled={isMutating}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 overflow-hidden">
                              <span className="truncate font-medium font-mono text-xs" title={item.domain}>
                                {item.domain}
                              </span>
                              <div className="flex items-center gap-2">
                                {item.sync.isFullySynced ? (
                                  <Badge variant="secondary" className="bg-emerald-50 text-[10px] text-emerald-700">
                                    Synced
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-amber-50 text-[10px] text-amber-700">
                                    Drift
                                  </Badge>
                                )}
                                {!item.sync.isFullySynced && (
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    className="h-4 w-4 text-amber-600"
                                    onClick={() => openSyncDialog(item)}
                                  >
                                    <CircleAlert className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
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
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {item.kind}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <DomainStatusToggle
                              checked={item.enabled}
                              disabled={isMutating}
                              activeLabel={
                                busyAction === `toggle:${key}` && item.enabled
                                  ? messages.lists.status.disabling
                                  : messages.lists.status.enabled
                              }
                              inactiveLabel={
                                busyAction === `toggle:${key}` && !item.enabled
                                  ? messages.lists.status.enabling
                                  : messages.lists.status.disabled
                              }
                              onCheckedChange={(c) => void toggleStatus(item, c)}
                            />
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn("block truncate text-sm", !item.comment && "text-muted-foreground")}
                              title={item.comment || "N/A"}
                            >
                              {item.comment || "N/A"}
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
                                <Button variant="ghost" size="icon-sm" disabled={isMutating}>
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
                                    requestDelete([
                                      {
                                        item: item.domain,
                                        type: item.type as "allow" | "deny",
                                        kind: item.kind as "exact" | "regex",
                                      },
                                    ])
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
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{messages.clients.table.rowsPerPage}</span>
                  <Select value={`${pageSize}`} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {messages.clients.table.showing(
                      filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1,
                      Math.min(page * pageSize, filteredItems.length),
                      filteredItems.length,
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    {messages.clients.table.previous}
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (totalPages <= 5) return true;
                        return Math.abs(p - page) <= 1 || p === 1 || p === totalPages;
                      })
                      .map((p, i, arr) => {
                        const prev = arr[i - 1];
                        const showGap = prev && p - prev > 1;
                        return (
                          <div key={p} className="flex items-center gap-1">
                            {showGap && <span className="text-muted-foreground text-xs">...</span>}
                            <Button
                              variant={p === page ? "default" : "outline"}
                              size="sm"
                              className="h-8 w-8 p-0 text-xs"
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    {messages.clients.table.next}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingItem && (
        <DomainEditDialog
          item={editingItem}
          groups={groups}
          open={editingItem !== null}
          onOpenChange={(o) => !o && setEditingItem(null)}
          onSave={(groupIds, comment) => saveEdit(editingItem, groupIds, comment)}
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
              const key = `${item.domain}-${item.type}-${item.kind}`;
              const states = getDomainSyncInstanceStates(item, source.baselineInstanceId);
              const selection = syncSelections[key] || {
                sourceInstanceId: item.origin.instanceId,
                targetInstanceIds: buildDefaultSyncTargetIds(item, source.baselineInstanceId, item.origin.instanceId),
              };
              const targetStates = states.filter((s) => s.instanceId !== selection.sourceInstanceId);
              const isSyncing = busyAction === `sync:${key}`;
              return (
                <Card key={key} size="sm" className="border py-4 shadow-none">
                  <CardHeader className="px-4 py-2">
                    <CardTitle className="truncate text-sm">
                      {item.domain} ({item.type}/{item.kind})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-4 py-2">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">{messages.groups.syncDialog.sourceLabel}</FieldLabel>
                        <Select
                          value={selection.sourceInstanceId}
                          onValueChange={(v) =>
                            setSyncSelections((prev) => ({
                              ...prev,
                              [key]: {
                                ...selection,
                                sourceInstanceId: v,
                                targetInstanceIds: buildDefaultSyncTargetIds(item, source.baselineInstanceId, v),
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {states.map((s) => (
                              <SelectItem key={s.instanceId} value={s.instanceId} className="text-xs">
                                {s.instanceName} ·{" "}
                                {s.hasDomain
                                  ? messages.groups.syncDialog.instanceHasGroup
                                  : messages.groups.syncDialog.instanceMissingGroup}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <div className="space-y-2">
                        <p className="font-medium text-xs">{messages.groups.syncDialog.targetsLabel}</p>
                        <div className="grid gap-2">
                          {targetStates.map((s) => (
                            <div key={s.instanceId} className="flex items-center gap-2 rounded-md border p-2">
                              <Checkbox
                                id={`sync-${key}-${s.instanceId}`}
                                checked={selection.targetInstanceIds.includes(s.instanceId)}
                                onCheckedChange={(c) =>
                                  setSyncSelections((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...selection,
                                      targetInstanceIds: c
                                        ? [...new Set([...selection.targetInstanceIds, s.instanceId])]
                                        : selection.targetInstanceIds.filter((id) => id !== s.instanceId),
                                    },
                                  }))
                                }
                              />
                              <label htmlFor={`sync-${key}-${s.instanceId}`} className="text-xs">
                                {s.instanceName} ({s.hasDomain ? "Has it" : "Missing"})
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => syncSingle(item)}
                        disabled={isMutating || selection.targetInstanceIds.length === 0}
                      >
                        <ArrowLeftRight className={cn("mr-2 h-3 w-3", isSyncing && "animate-spin")} />
                        {isSyncing ? messages.groups.syncDialog.syncLoading : messages.groups.syncDialog.syncAction}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <DialogFooter className="flex w-full items-center justify-between">
            {!syncDialogAddress && unsyncedItems.length > 0 && (
              <Button size="sm" onClick={runBulkSync} disabled={isMutating}>
                <ArrowLeftRight className={cn("mr-2 h-4 w-4", busyAction === "sync:all" && "animate-spin")} />
                {messages.groups.table.sync} All
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setIsSyncDialogOpen(false)} disabled={isMutating}>
              {messages.sidebar.sync.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog !== null} onOpenChange={(o) => !o && !isMutating && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <p className="text-rose-600 text-sm">{messages.groups.delete.irreversible}</p>
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                id="domains-delete-skip"
                checked={rememberDeleteChoice}
                onCheckedChange={(c) => setRememberDeleteChoice(c === true)}
                disabled={isMutating}
              />
              <label htmlFor="domains-delete-skip">{messages.groups.delete.dontAskAgain}</label>
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
