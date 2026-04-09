"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, CircleAlert, Pencil, RefreshCw, Trash2, Users } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { GroupItem, GroupsListResponse, GroupsMutationResponse } from "@/lib/api/yapd-types";
import { getClientCookie, setClientCookie } from "@/lib/cookie.client";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useNavigationSummaryStore } from "@/stores/navigation-summary/navigation-summary-provider";

import {
  buildCreateGroupSchema,
  buildEditGroupSchema,
  DEFAULT_CREATE_GROUP_FORM_VALUES,
  DEFAULT_EDIT_GROUP_FORM_VALUES,
} from "./group-form-schema";
import { GroupStatusToggle } from "./group-status-toggle";

type GroupCreateFormValues = {
  name: string;
  comment: string;
};

type GroupEditFormValues = {
  name: string;
  comment: string;
};

type DeleteDialogState = {
  names: string[];
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

type GroupSyncInstanceState = {
  instanceId: string;
  instanceName: string;
  hasGroup: boolean;
};

function sortGroupItems(items: GroupItem[]) {
  return [...items].sort((left, right) => {
    if (isImmutableGroup(left) && !isImmutableGroup(right)) {
      return -1;
    }

    if (!isImmutableGroup(left) && isImmutableGroup(right)) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function isImmutableGroup(item: GroupItem) {
  return item.id === FRONTEND_CONFIG.groups.immutableDefaultGroupId;
}

function sortSyncInstanceStates(states: GroupSyncInstanceState[], baselineInstanceId: string) {
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

function getGroupSyncInstanceStates(item: GroupItem, baselineInstanceId: string) {
  const instanceStates = new Map<string, GroupSyncInstanceState>();

  for (const instance of item.sync.sourceInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasGroup: true,
    });
  }

  for (const instance of item.sync.missingInstances) {
    instanceStates.set(instance.instanceId, {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      hasGroup: false,
    });
  }

  return sortSyncInstanceStates([...instanceStates.values()], baselineInstanceId);
}

function buildDefaultSyncTargetIds(item: GroupItem, baselineInstanceId: string, sourceInstanceId: string) {
  const sourceState = getGroupSyncInstanceStates(item, baselineInstanceId).find(
    (instance) => instance.instanceId === sourceInstanceId,
  );

  if (!sourceState) {
    return [];
  }

  return getGroupSyncInstanceStates(item, baselineInstanceId)
    .filter((instance) => instance.instanceId !== sourceInstanceId && instance.hasGroup !== sourceState.hasGroup)
    .map((instance) => instance.instanceId);
}

function buildSyncSelections(items: GroupItem[], baselineInstanceId: string): SyncSelectionState {
  return Object.fromEntries(
    items
      .filter((item) => item.sync.missingInstances.length > 0)
      .map((item) => [
        item.name,
        {
          sourceInstanceId: item.origin.instanceId,
          targetInstanceIds: buildDefaultSyncTargetIds(item, baselineInstanceId, item.origin.instanceId),
        },
      ]),
  );
}

export function GroupsWorkspace({
  initialData,
}: Readonly<{
  initialData: GroupsListResponse;
}>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const createSchema = useMemo(() => buildCreateGroupSchema(messages), [messages]);
  const editSchema = useMemo(() => buildEditGroupSchema(messages), [messages]);
  const refreshNavigationSummary = useNavigationSummaryStore((state) => state.refreshSummary);
  const [items, setItems] = useState(() => sortGroupItems(initialData.items));
  const [source, setSource] = useState(initialData.source);
  const [summary, setSummary] = useState(initialData.summary);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncDialogGroupName, setSyncDialogGroupName] = useState<string | null>(null);
  const [syncSelections, setSyncSelections] = useState<SyncSelectionState>(() =>
    buildSyncSelections(initialData.items, initialData.source.baselineInstanceId),
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);
  const createForm = useForm<GroupCreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: DEFAULT_CREATE_GROUP_FORM_VALUES,
  });
  const editForm = useForm<GroupEditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: DEFAULT_EDIT_GROUP_FORM_VALUES,
  });

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

    return items.filter((item) => item.name.toLowerCase().includes(searchTerm));
  }, [items, searchTerm]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.filter((item) => !isImmutableGroup(item)).map((item) => item.id));

    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredItems]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectableVisibleItems = filteredItems.filter((item) => !isImmutableGroup(item));
  const selectedGroups = items.filter((item) => selectedIdSet.has(item.id));
  const unsyncedItems = useMemo(() => items.filter((item) => item.sync.missingInstances.length > 0), [items]);
  const syncDialogItems = useMemo(
    () => (syncDialogGroupName ? unsyncedItems.filter((item) => item.name === syncDialogGroupName) : unsyncedItems),
    [syncDialogGroupName, unsyncedItems],
  );
  const allVisibleSelected =
    selectableVisibleItems.length > 0 && selectableVisibleItems.every((item) => selectedIdSet.has(item.id));
  const someVisibleSelected = selectableVisibleItems.some((item) => selectedIdSet.has(item.id));
  const isMutating = busyAction !== null;

  const refreshGroups = async () => {
    const { data, response } = await client.GET<GroupsListResponse>("/groups");

    if (!response.ok || !data) {
      toast.error(messages.groups.toasts.refreshFailed);
      return null;
    }

    setItems(sortGroupItems(data.items));
    setSource(data.source);
    setSummary(data.summary);
    return data;
  };

  const runRefresh = async () => {
    setBusyAction("refresh");

    try {
      await refreshGroups();
    } finally {
      setBusyAction(null);
    }
  };

  const handleMutationSuccess = async (data: GroupsMutationResponse, successMessage: string) => {
    if (data.status === "partial") {
      toast.warning(messages.groups.toasts.partialWarning(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(successMessage);
    }

    await refreshGroups();
  };

  const openSyncDialog = (groupName?: string) => {
    setSyncDialogGroupName(groupName ?? null);
    setSyncSelections(buildSyncSelections(items, source.baselineInstanceId));
    setSyncError(null);
    setIsSyncDialogOpen(true);
  };

  const handleSyncDialogOpenChange = (open: boolean) => {
    if (!open && isMutating) {
      return;
    }

    setIsSyncDialogOpen(open);

    if (!open) {
      setSyncDialogGroupName(null);
      setSyncError(null);
    }
  };

  const updateSyncSource = (groupName: string, sourceInstanceId: string) => {
    const group = items.find((item) => item.name === groupName);

    setSyncSelections((current) => ({
      ...current,
      [groupName]: {
        sourceInstanceId,
        targetInstanceIds: group ? buildDefaultSyncTargetIds(group, source.baselineInstanceId, sourceInstanceId) : [],
      },
    }));
  };

  const toggleSyncTarget = (groupName: string, targetInstanceId: string, checked: boolean) => {
    setSyncSelections((current) => {
      const previous = current[groupName];
      const nextTargetIds = checked
        ? [...new Set([...(previous?.targetInstanceIds ?? []), targetInstanceId])]
        : (previous?.targetInstanceIds ?? []).filter((instanceId) => instanceId !== targetInstanceId);

      return {
        ...current,
        [groupName]: {
          sourceInstanceId:
            previous?.sourceInstanceId ?? items.find((item) => item.name === groupName)?.origin.instanceId ?? "",
          targetInstanceIds: nextTargetIds,
        },
      };
    });
  };

  const syncSingleGroup = async (group: GroupItem) => {
    const selection = syncSelections[group.name] ?? {
      sourceInstanceId: group.origin.instanceId,
      targetInstanceIds: buildDefaultSyncTargetIds(group, source.baselineInstanceId, group.origin.instanceId),
    };

    if (selection.targetInstanceIds.length === 0) {
      setSyncError(messages.groups.syncDialog.targetsRequired);
      toast.error(messages.groups.syncDialog.targetsRequired);
      return;
    }

    setBusyAction(`sync:${group.name}`);
    setSyncError(null);

    const { data, response } = await client.POST<GroupsMutationResponse>("/groups/sync", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        groupName: group.name,
        sourceInstanceId: selection.sourceInstanceId,
        targetInstanceIds: selection.targetInstanceIds,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      const message = await getApiErrorMessage(response);
      setSyncError(message);
      toast.error(message);
      return;
    }

    if (data.status === "partial") {
      toast.warning(messages.groups.toasts.partialWarning(data.summary.successfulCount, data.summary.failedCount));
    } else {
      toast.success(messages.groups.toasts.syncGroupSuccess(group.name));
    }

    const refreshed = await refreshGroups();

    if (!refreshed) {
      return;
    }

    const nextUnsyncedItems = refreshed.items.filter((item) => item.sync.missingInstances.length > 0);
    setSyncSelections(buildSyncSelections(nextUnsyncedItems, refreshed.source.baselineInstanceId));

    if (syncDialogGroupName) {
      if (!nextUnsyncedItems.some((item) => item.name === syncDialogGroupName)) {
        handleSyncDialogOpenChange(false);
      }
      return;
    }

    if (nextUnsyncedItems.length === 0) {
      handleSyncDialogOpenChange(false);
    }
  };

  const submitCreate = async (values: GroupCreateFormValues) => {
    const parsedValues = createSchema.safeParse(values);

    if (!parsedValues.success) {
      await createForm.trigger();
      return;
    }

    setBusyAction("create");
    setCreateError(null);

    const { data, response } = await client.POST<GroupsMutationResponse>("/groups", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        name: parsedValues.data.name,
        comment: parsedValues.data.comment,
        enabled: true,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      const message = await getApiErrorMessage(response);
      setCreateError(message);
      toast.error(message);
      return;
    }

    createForm.reset(DEFAULT_CREATE_GROUP_FORM_VALUES);
    await handleMutationSuccess(data, messages.groups.toasts.createSuccess);
    await refreshNavigationSummary();
  };

  const openEditDialog = (group: GroupItem) => {
    setEditingGroup(group);
    setEditError(null);
    editForm.reset({
      name: group.name,
      comment: group.comment ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open && isMutating) {
      return;
    }

    setIsEditDialogOpen(open);

    if (!open) {
      setEditingGroup(null);
      setEditError(null);
      editForm.reset(DEFAULT_EDIT_GROUP_FORM_VALUES);
    }
  };

  const submitEdit = async (values: GroupEditFormValues) => {
    if (!editingGroup) {
      return;
    }

    const parsedValues = editSchema.safeParse(values);

    if (!parsedValues.success) {
      await editForm.trigger();
      return;
    }

    setBusyAction(`edit:${editingGroup.id}`);
    setEditError(null);

    const { data, response } = await client.PUT<GroupsMutationResponse>("/groups/{name}", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          name: editingGroup.name,
        },
      },
      body: {
        name: parsedValues.data.name,
        comment: parsedValues.data.comment,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      const message = await getApiErrorMessage(response);
      setEditError(message);
      toast.error(message);
      return;
    }

    handleEditOpenChange(false);
    await handleMutationSuccess(data, messages.groups.toasts.updateSuccess);
  };

  const toggleGroupStatus = async (group: GroupItem, enabled: boolean) => {
    setBusyAction(`toggle:${group.id}`);

    const { data, response } = await client.PATCH<GroupsMutationResponse>("/groups/{name}/status", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          name: group.name,
        },
      },
      body: {
        enabled,
      },
    });

    setBusyAction(null);

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    await handleMutationSuccess(
      data,
      enabled ? messages.groups.toasts.enabledSuccess : messages.groups.toasts.disabledSuccess,
    );
  };

  const executeDelete = async (names: string[]) => {
    setBusyAction(names.length === 1 ? `delete:${names[0]}` : "delete:batch");
    setDeleteError(null);

    const result =
      names.length === 1
        ? await client.DELETE<GroupsMutationResponse>("/groups/{name}", {
            headers: {
              "x-yapd-csrf": csrfToken,
            },
            params: {
              path: {
                name: names[0] ?? "",
              },
            },
          })
        : await client.POST<GroupsMutationResponse>("/groups/batchDelete", {
            headers: {
              "x-yapd-csrf": csrfToken,
            },
            body: {
              items: names,
            },
          });

    setBusyAction(null);

    if (!result.response.ok || !result.data) {
      const message = await getApiErrorMessage(result.response);
      setDeleteError(message);
      toast.error(message);
      return false;
    }

    setDeleteDialog(null);
    setSelectedIds([]);
    await handleMutationSuccess(result.data, messages.groups.toasts.deleteSuccess);
    await refreshNavigationSummary();
    return true;
  };

  const requestDelete = (names: string[]) => {
    const validNames = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];

    if (validNames.length === 0 || isMutating) {
      return;
    }

    if (skipDeleteConfirm) {
      void executeDelete(validNames);
      return;
    }

    setRememberDeleteChoice(false);
    setDeleteError(null);
    setDeleteDialog({
      names: validNames,
      title:
        validNames.length === 1
          ? messages.groups.delete.titleSingle(validNames[0] ?? "")
          : messages.groups.delete.titleBatch(validNames.length),
      description:
        validNames.length === 1
          ? messages.groups.delete.descriptionSingle(validNames[0] ?? "")
          : messages.groups.delete.descriptionBatch(validNames.length),
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) {
      return;
    }

    if (rememberDeleteChoice) {
      setClientCookie(
        FRONTEND_CONFIG.groups.deleteConfirmCookieKey,
        "1",
        FRONTEND_CONFIG.groups.deleteConfirmCookieDays,
      );
      setSkipDeleteConfirm(true);
    }

    await executeDelete(deleteDialog.names);
  };

  const toggleSelectedGroup = (group: GroupItem, checked: boolean) => {
    if (isImmutableGroup(group)) {
      return;
    }

    setSelectedIds((current) =>
      checked ? [...new Set([...current, group.id])] : current.filter((itemId) => itemId !== group.id),
    );
  };

  const toggleAllVisibleGroups = (checked: boolean) => {
    if (!checked) {
      const visibleIds = new Set(selectableVisibleItems.map((item) => item.id));
      setSelectedIds((current) => current.filter((itemId) => !visibleIds.has(itemId)));
      return;
    }

    setSelectedIds((current) => [...new Set([...current, ...selectableVisibleItems.map((item) => item.id)])]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{messages.groups.create.title}</CardTitle>
            <CardDescription>{messages.groups.create.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            noValidate
            className="space-y-4"
            onSubmit={createForm.handleSubmit((values) => void submitCreate(values))}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto]">
              <Controller
                control={createForm.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor="groups-create-name">{messages.groups.create.nameLabel}</FieldLabel>
                    <Input {...field} id="groups-create-name" aria-invalid={fieldState.invalid} disabled={isMutating} />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />

              <Controller
                control={createForm.control}
                name="comment"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor="groups-create-comment">{messages.groups.create.commentLabel}</FieldLabel>
                    <Input
                      {...field}
                      id="groups-create-comment"
                      aria-invalid={fieldState.invalid}
                      disabled={isMutating}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />

              <div className="flex items-end">
                <Button type="submit" className="w-full lg:w-auto" disabled={isMutating}>
                  {busyAction === "create" ? messages.groups.create.submitLoading : messages.groups.create.submitIdle}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-muted-foreground text-sm">
              <ul className="list-disc space-y-2 pl-5">
                <li>{messages.groups.create.tipMultiple}</li>
                <li>{messages.groups.create.tipQuoted}</li>
              </ul>
            </div>

            {createError ? (
              <Alert variant="destructive">
                <AlertTitle>{messages.groups.create.title}</AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{messages.groups.table.title}</CardTitle>
              <Badge variant="secondary" className="rounded-full px-2.5">
                {summary.totalItems}
              </Badge>
            </div>
            <CardDescription>{messages.groups.table.description(source.baselineInstanceName)}</CardDescription>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={messages.groups.table.searchPlaceholder}
              disabled={isMutating}
              className="min-w-56"
            />
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void runRefresh()}>
              <RefreshCw className={cn(busyAction === "refresh" ? "animate-spin" : undefined)} />
              {busyAction === "refresh" ? messages.groups.table.refreshLoading : messages.groups.table.refresh}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => openSyncDialog()}>
              <ArrowLeftRight />
              {messages.groups.table.sync}
            </Button>
            {selectedGroups.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() => requestDelete(selectedGroups.map((item) => item.name))}
              >
                {messages.groups.table.deleteSelected(selectedGroups.length)}
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>{messages.groups.table.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.groups.table.emptyDescription}</EmptyDescription>
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
                        aria-label={messages.groups.table.selectAll}
                        disabled={isMutating || selectableVisibleItems.length === 0}
                        onCheckedChange={(checked) => toggleAllVisibleGroups(checked === true)}
                      />
                    </TableHead>
                    <TableHead className="text-center">{messages.groups.table.name}</TableHead>
                    <TableHead className="text-center">{messages.groups.table.status}</TableHead>
                    <TableHead className="text-center">{messages.groups.table.comment}</TableHead>
                    <TableHead className="text-center">{messages.groups.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const immutable = isImmutableGroup(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedIdSet.has(item.id)}
                            aria-label={messages.groups.table.selectRow(item.name)}
                            disabled={immutable || isMutating}
                            onCheckedChange={(checked) => toggleSelectedGroup(item, checked === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {immutable ? <Badge variant="outline">{messages.groups.table.protectedBadge}</Badge> : null}
                            {item.sync.missingInstances.length > 0 ? (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                aria-label={messages.groups.table.syncIssueAction(item.name)}
                                title={messages.groups.table.syncIssueAction(item.name)}
                                disabled={isMutating}
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => openSyncDialog(item.name)}
                              >
                                <CircleAlert />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <GroupStatusToggle
                            checked={item.enabled}
                            disabled={immutable || isMutating}
                            activeLabel={
                              busyAction === `toggle:${item.id}` && item.enabled
                                ? messages.groups.status.disabling
                                : messages.groups.status.active
                            }
                            inactiveLabel={
                              busyAction === `toggle:${item.id}` && !item.enabled
                                ? messages.groups.status.enabling
                                : messages.groups.status.inactive
                            }
                            onCheckedChange={(checked) => void toggleGroupStatus(item, checked)}
                          />
                        </TableCell>
                        <TableCell className="max-w-lg">
                          <span className={cn(!item.comment && "text-muted-foreground")}>
                            {item.comment && item.comment.length > 0
                              ? item.comment
                              : messages.common.versionUnavailable}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label={messages.groups.table.edit}
                              title={messages.groups.table.edit}
                              disabled={immutable || isMutating}
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label={messages.groups.table.delete}
                              title={messages.groups.table.delete}
                              className="text-destructive hover:text-destructive"
                              disabled={immutable || isMutating}
                              onClick={() => requestDelete([item.name])}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isSyncDialogOpen} onOpenChange={handleSyncDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl" showCloseButton={!isMutating}>
          <DialogHeader>
            <DialogTitle>
              {syncDialogGroupName
                ? messages.groups.syncDialog.titleSingle(syncDialogGroupName)
                : messages.groups.syncDialog.titleAll}
            </DialogTitle>
            <DialogDescription>
              {syncDialogGroupName
                ? messages.groups.syncDialog.descriptionSingle(syncDialogGroupName)
                : messages.groups.syncDialog.descriptionAll(source.baselineInstanceName)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {source.unavailableInstanceCount > 0 ? (
              <Alert>
                <AlertTitle>{messages.groups.table.sync}</AlertTitle>
                <AlertDescription>
                  {messages.groups.syncDialog.partialAvailability(source.availableInstanceCount, source.totalInstances)}
                </AlertDescription>
              </Alert>
            ) : null}

            {syncError ? (
              <Alert variant="destructive">
                <AlertTitle>{messages.groups.table.sync}</AlertTitle>
                <AlertDescription>{syncError}</AlertDescription>
              </Alert>
            ) : null}

            {syncDialogItems.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ArrowLeftRight />
                  </EmptyMedia>
                  <EmptyTitle>{messages.groups.syncDialog.emptyTitle}</EmptyTitle>
                  <EmptyDescription>{messages.groups.syncDialog.emptyDescription}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {syncDialogItems.map((item) => {
                  const instanceStates = getGroupSyncInstanceStates(item, source.baselineInstanceId);
                  const selection = syncSelections[item.name] ?? {
                    sourceInstanceId: item.origin.instanceId,
                    targetInstanceIds: buildDefaultSyncTargetIds(
                      item,
                      source.baselineInstanceId,
                      item.origin.instanceId,
                    ),
                  };
                  const targetStates = instanceStates.filter(
                    (instance) => instance.instanceId !== selection.sourceInstanceId,
                  );
                  const selectedTargets = new Set(selection.targetInstanceIds);
                  const isSyncing = busyAction === `sync:${item.name}`;

                  return (
                    <Card key={item.name} size="sm" className="border py-4 shadow-none">
                      <CardHeader className="gap-3">
                        <div>
                          <CardTitle>{item.name}</CardTitle>
                          <CardDescription>
                            {messages.groups.syncDialog.availabilityHint(
                              item.sync.sourceInstances.length,
                              item.sync.missingInstances.length,
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {messages.groups.syncDialog.presentCount(item.sync.sourceInstances.length)}
                          </Badge>
                          <Badge variant="outline">
                            {messages.groups.syncDialog.missingCount(item.sync.missingInstances.length)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                          <Field className="gap-2">
                            <FieldLabel>{messages.groups.syncDialog.sourceLabel}</FieldLabel>
                            <Select
                              value={selection.sourceInstanceId}
                              disabled={isMutating}
                              onValueChange={(value) => updateSyncSource(item.name, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={messages.groups.syncDialog.sourcePlaceholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {instanceStates.map((instance) => (
                                  <SelectItem key={instance.instanceId} value={instance.instanceId}>
                                    {instance.instanceName} ·{" "}
                                    {instance.hasGroup
                                      ? messages.groups.syncDialog.instanceHasGroup
                                      : messages.groups.syncDialog.instanceMissingGroup}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <div className="space-y-2">
                            <p className="font-medium text-sm">{messages.groups.syncDialog.targetsLabel}</p>
                            <div className="rounded-lg border bg-muted/20 p-3">
                              {targetStates.length === 0 ? (
                                <p className="text-muted-foreground text-sm">{messages.groups.syncDialog.noTargets}</p>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {targetStates.map((instance) => {
                                    const checkboxId = `groups-sync-${item.id}-${instance.instanceId}`;

                                    return (
                                      <div
                                        key={instance.instanceId}
                                        className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                                      >
                                        <Checkbox
                                          id={checkboxId}
                                          checked={selectedTargets.has(instance.instanceId)}
                                          disabled={isMutating}
                                          onCheckedChange={(checked) =>
                                            toggleSyncTarget(item.name, instance.instanceId, checked === true)
                                          }
                                        />
                                        <label htmlFor={checkboxId} className="flex items-center gap-2">
                                          <span>{instance.instanceName}</span>
                                          <Badge variant={instance.hasGroup ? "secondary" : "outline"}>
                                            {instance.hasGroup
                                              ? messages.groups.syncDialog.instanceHasGroup
                                              : messages.groups.syncDialog.instanceMissingGroup}
                                          </Badge>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            disabled={isMutating || selection.targetInstanceIds.length === 0}
                            onClick={() => void syncSingleGroup(item)}
                          >
                            <ArrowLeftRight className={cn(isSyncing ? "animate-pulse" : undefined)} />
                            {isSyncing ? messages.groups.syncDialog.syncLoading : messages.groups.syncDialog.syncAction}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isMutating}
              onClick={() => handleSyncDialogOpenChange(false)}
            >
              {messages.groups.syncDialog.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!isMutating}>
          <DialogHeader>
            <DialogTitle>{messages.groups.edit.title}</DialogTitle>
            <DialogDescription>{messages.groups.edit.description}</DialogDescription>
          </DialogHeader>
          <form noValidate className="space-y-4" onSubmit={editForm.handleSubmit((values) => void submitEdit(values))}>
            <Controller
              control={editForm.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="groups-edit-name">{messages.groups.edit.nameLabel}</FieldLabel>
                  <Input {...field} id="groups-edit-name" aria-invalid={fieldState.invalid} disabled={isMutating} />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              control={editForm.control}
              name="comment"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="groups-edit-comment">{messages.groups.edit.commentLabel}</FieldLabel>
                  <Textarea
                    {...field}
                    id="groups-edit-comment"
                    rows={4}
                    aria-invalid={fieldState.invalid}
                    disabled={isMutating}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            {editError ? (
              <Alert variant="destructive">
                <AlertTitle>{messages.groups.edit.title}</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={isMutating} onClick={() => handleEditOpenChange(false)}>
                {messages.groups.edit.cancel}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {busyAction?.startsWith("edit:") ? messages.groups.edit.submitLoading : messages.groups.edit.submitIdle}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteDialog(null);
            setDeleteError(null);
            setRememberDeleteChoice(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog?.title ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialog?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <p className="text-rose-600 text-sm">{messages.groups.delete.irreversible}</p>
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                id="groups-delete-skip-confirm"
                checked={rememberDeleteChoice}
                disabled={isMutating}
                onCheckedChange={(checked) => setRememberDeleteChoice(checked === true)}
              />
              <label htmlFor="groups-delete-skip-confirm">{messages.groups.delete.dontAskAgain}</label>
            </div>

            {deleteError ? (
              <Alert variant="destructive">
                <AlertTitle>{deleteDialog?.title ?? messages.groups.delete.confirmSingle}</AlertTitle>
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{messages.groups.delete.cancel}</AlertDialogCancel>
            <Button variant="destructive" disabled={isMutating} onClick={() => void confirmDelete()}>
              {isMutating
                ? messages.groups.delete.confirmLoading
                : deleteDialog && deleteDialog.names.length > 1
                  ? messages.groups.delete.confirmBatch(deleteDialog.names.length)
                  : messages.groups.delete.confirmSingle}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
