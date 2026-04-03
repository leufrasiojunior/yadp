"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, Pencil, RefreshCw, Trash2, Users } from "lucide-react";
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

export function GroupsWorkspace({
  initialItems,
  initialSource,
}: Readonly<{
  initialItems: GroupItem[];
  initialSource: GroupsListResponse["source"];
}>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const createSchema = useMemo(() => buildCreateGroupSchema(messages), [messages]);
  const editSchema = useMemo(() => buildEditGroupSchema(messages), [messages]);
  const [items, setItems] = useState(() => sortGroupItems(initialItems));
  const [source, setSource] = useState(initialSource);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
  const allVisibleSelected =
    selectableVisibleItems.length > 0 && selectableVisibleItems.every((item) => selectedIdSet.has(item.id));
  const someVisibleSelected = selectableVisibleItems.some((item) => selectedIdSet.has(item.id));
  const isMutating = busyAction !== null;

  const refreshGroups = async () => {
    const { data, response } = await client.GET<GroupsListResponse>("/groups");

    if (!response.ok || !data) {
      toast.error(messages.groups.toasts.refreshFailed);
      return false;
    }

    setItems(sortGroupItems(data.items));
    setSource(data.source);
    return true;
  };

  const runRefresh = async () => {
    setBusyAction("refresh");

    try {
      await refreshGroups();
    } finally {
      setBusyAction(null);
    }
  };

  const runSync = async () => {
    setBusyAction("sync");

    try {
      const { data, response } = await client.POST<GroupsMutationResponse>("/groups/sync", {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
      });

      if (!response.ok || !data) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      await handleMutationSuccess(data, messages.groups.toasts.syncSuccess);
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
          <div className="text-center">
            <CardTitle>{messages.groups.table.title}</CardTitle>
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
            <Button type="button" variant="outline" size="sm" disabled={isMutating} onClick={() => void runSync()}>
              <ArrowLeftRight className={cn(busyAction === "sync" ? "animate-pulse" : undefined)} />
              {busyAction === "sync" ? messages.groups.table.syncLoading : messages.groups.table.sync}
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
                    <TableHead>{messages.groups.table.name}</TableHead>
                    <TableHead>{messages.groups.table.status}</TableHead>
                    <TableHead>{messages.groups.table.comment}</TableHead>
                    <TableHead className="text-right">{messages.groups.table.actions}</TableHead>
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
