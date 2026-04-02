"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  InstanceDetailResponse,
  InstanceItem,
  InstanceListResponse,
  InstanceMutationResponse,
  InstanceReauthenticateResponse,
  InstanceTestResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";

import { CreateInstanceDialog } from "./create-instance-dialog";
import { InstanceConnectionFields } from "./instance-connection-fields";
import {
  buildInstanceFormSchema,
  DEFAULT_INSTANCE_FORM_VALUES,
  type InstanceFormValues,
  toInstanceRequestBody,
} from "./instance-form-schema";

export function InstancesWorkspace({
  initialItems,
}: Readonly<{
  initialItems: InstanceItem[];
}>) {
  const { messages, formatDateTime } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getBrowserApiClient(), []);
  const editInstanceSchema = useMemo(() => buildInstanceFormSchema(messages, { requirePassword: false }), [messages]);
  const [items, setItems] = useState(initialItems);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reauthenticatingId, setReauthenticatingId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState<InstanceDetailResponse["instance"] | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const editRequestIdRef = useRef(0);
  const editForm = useForm<InstanceFormValues>({
    resolver: zodResolver(editInstanceSchema),
    defaultValues: DEFAULT_INSTANCE_FORM_VALUES,
  });
  const editCertificatePem = useWatch({
    control: editForm.control,
    name: "certificatePem",
  });
  const editAllowSelfSigned = useWatch({
    control: editForm.control,
    name: "allowSelfSigned",
  });
  const isEditAllowSelfSignedDisabled = (editCertificatePem ?? "").trim().length > 0;

  useEffect(() => {
    if (isEditAllowSelfSignedDisabled && editAllowSelfSigned) {
      editForm.setValue("allowSelfSigned", false, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [editAllowSelfSigned, editForm, isEditAllowSelfSignedDisabled]);

  const refreshItems = async () => {
    const { data, response } = await client.GET<InstanceListResponse>("/instances");

    if (!response.ok || !data) {
      toast.error(messages.forms.instances.toasts.refreshFailed);
      return;
    }

    setItems(data.items);
  };

  const resetEditDialog = () => {
    editRequestIdRef.current += 1;
    setIsEditDialogOpen(false);
    setEditingInstanceId(null);
    setEditDetails(null);
    setEditLoadError(null);
    setEditSaveError(null);
    setIsEditLoading(false);
    editForm.reset(DEFAULT_INSTANCE_FORM_VALUES);
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open) {
      if (editForm.formState.isSubmitting) {
        return;
      }

      resetEditDialog();
      return;
    }

    setIsEditDialogOpen(true);
  };

  const loadEditDetails = async (instanceId: string) => {
    const requestId = editRequestIdRef.current + 1;
    editRequestIdRef.current = requestId;
    setIsEditLoading(true);
    setEditDetails(null);
    setEditLoadError(null);
    setEditSaveError(null);

    const { data, response } = await client.GET<InstanceDetailResponse>("/instances/{id}", {
      params: {
        path: {
          id: instanceId,
        },
      },
    });

    if (requestId !== editRequestIdRef.current) {
      return;
    }

    if (!response.ok || !data) {
      const message = await getApiErrorMessage(response);
      setIsEditLoading(false);
      setEditLoadError(message);
      toast.error(message || messages.forms.instances.toasts.detailsLoadFailed);
      return;
    }

    setEditDetails(data.instance);
    setIsEditLoading(false);
    editForm.reset({
      name: data.instance.name,
      baseUrl: data.instance.baseUrl,
      servicePassword: "",
      allowSelfSigned: data.instance.allowSelfSigned,
      certificatePem: data.instance.certificatePem ?? "",
    });
  };

  const openEditDialog = (instanceId: string) => {
    setEditingInstanceId(instanceId);
    setIsEditDialogOpen(true);
    void loadEditDetails(instanceId);
  };

  const updateInstance = async (values: InstanceFormValues) => {
    if (!editingInstanceId) {
      return;
    }

    setEditSaveError(null);
    const { response } = await client.PATCH<InstanceMutationResponse>("/instances/{id}", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          id: editingInstanceId,
        },
      },
      body: toInstanceRequestBody(values),
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response);
      setEditSaveError(message);
      toast.error(message);
      return;
    }

    toast.success(messages.forms.instances.toasts.updateSuccess);
    resetEditDialog();
    await refreshItems();
  };

  const testInstance = async (instanceId: string) => {
    setTestingId(instanceId);
    const { response } = await client.POST<InstanceTestResponse>("/instances/{id}/test", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          id: instanceId,
        },
      },
    });

    setTestingId(null);

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(messages.forms.instances.toasts.testSuccess);
    await refreshItems();
  };

  const reauthenticateInstance = async (instanceId: string) => {
    setReauthenticatingId(instanceId);
    const { response } = await client.POST<InstanceReauthenticateResponse>("/instances/{id}/reauthenticate", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          id: instanceId,
        },
      },
    });

    setReauthenticatingId(null);

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(messages.forms.instances.toasts.reauthenticateSuccess);
    await refreshItems();
  };

  const getSessionStatusLabel = (status: InstanceItem["sessionStatus"]) => {
    switch (status) {
      case "active":
        return messages.forms.instances.table.statusActive;
      case "expired":
        return messages.forms.instances.table.statusExpired;
      case "error":
        return messages.forms.instances.table.statusError;
      default:
        return messages.forms.instances.table.statusMissing;
    }
  };

  const getSessionStatusVariant = (status: InstanceItem["sessionStatus"]) => {
    switch (status) {
      case "active":
        return "secondary" as const;
      case "error":
      case "expired":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const getManagedByLabel = (managedBy: InstanceItem["sessionManagedBy"]) => {
    if (managedBy === "human-master") {
      return messages.forms.instances.table.humanMaster;
    }

    if (managedBy === "stored-secret") {
      return messages.forms.instances.table.storedSecret;
    }

    return null;
  };

  const isRowEditBusy = (instanceId: string) =>
    editingInstanceId === instanceId && (isEditLoading || editForm.formState.isSubmitting);

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>{messages.forms.instances.table.title}</CardTitle>
              <CardDescription>{messages.forms.instances.table.description}</CardDescription>
            </div>
            <CreateInstanceDialog onCreated={refreshItems} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.forms.instances.table.name}</TableHead>
                  <TableHead>{messages.forms.instances.table.baseUrl}</TableHead>
                  <TableHead>{messages.forms.instances.table.trust}</TableHead>
                  <TableHead>{messages.forms.instances.table.version}</TableHead>
                  <TableHead>{messages.forms.instances.table.lastValidation}</TableHead>
                  <TableHead>{messages.forms.instances.table.session}</TableHead>
                  <TableHead>{messages.forms.instances.table.validUntil}</TableHead>
                  <TableHead>{messages.forms.instances.table.lastError}</TableHead>
                  <TableHead className="text-right">{messages.forms.instances.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {item.isBaseline
                          ? messages.forms.instances.table.baseline
                          : messages.forms.instances.table.managed}
                      </div>
                    </TableCell>
                    <TableCell>{item.baseUrl}</TableCell>
                    <TableCell>{item.trustMode}</TableCell>
                    <TableCell>{item.lastKnownVersion ?? messages.common.versionUnavailable}</TableCell>
                    <TableCell>
                      {item.lastValidatedAt ? formatDateTime(item.lastValidatedAt) : messages.common.versionUnavailable}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={getSessionStatusVariant(item.sessionStatus)}>
                          {getSessionStatusLabel(item.sessionStatus)}
                        </Badge>
                        {getManagedByLabel(item.sessionManagedBy) ? (
                          <div className="text-muted-foreground text-xs">
                            {getManagedByLabel(item.sessionManagedBy)}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.sessionValidUntil
                        ? formatDateTime(item.sessionValidUntil)
                        : messages.common.versionUnavailable}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-72 text-sm">
                        {item.sessionLastErrorMessage ?? messages.common.versionUnavailable}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRowEditBusy(item.id) || testingId === item.id || reauthenticatingId === item.id}
                          onClick={() => openEditDialog(item.id)}
                        >
                          {isRowEditBusy(item.id)
                            ? messages.forms.instances.table.editLoading
                            : messages.forms.instances.table.editIdle}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRowEditBusy(item.id) || testingId === item.id || reauthenticatingId === item.id}
                          onClick={() => void testInstance(item.id)}
                        >
                          {testingId === item.id
                            ? messages.forms.instances.table.testLoading
                            : messages.forms.instances.table.testIdle}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRowEditBusy(item.id) || reauthenticatingId === item.id || testingId === item.id}
                          onClick={() => void reauthenticateInstance(item.id)}
                        >
                          {reauthenticatingId === item.id
                            ? messages.forms.instances.table.reauthenticateLoading
                            : messages.forms.instances.table.reauthenticateIdle}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!editForm.formState.isSubmitting}>
          <DialogHeader>
            <DialogTitle>{messages.forms.instances.edit.title}</DialogTitle>
            <DialogDescription>{messages.forms.instances.edit.description}</DialogDescription>
          </DialogHeader>

          {isEditLoading ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">{messages.forms.instances.edit.loading}</p>
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </div>
          ) : editLoadError ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTitle>{messages.forms.instances.edit.loadFailedTitle}</AlertTitle>
                <AlertDescription>{editLoadError}</AlertDescription>
              </Alert>
              <DialogFooter className="justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editingInstanceId}
                  onClick={() => {
                    if (editingInstanceId) {
                      void loadEditDetails(editingInstanceId);
                    }
                  }}
                >
                  {messages.common.retry}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleEditOpenChange(false)}>
                  {messages.forms.instances.edit.cancel}
                </Button>
              </DialogFooter>
            </div>
          ) : editDetails ? (
            <form
              noValidate
              className="space-y-6"
              onSubmit={editForm.handleSubmit((values) => void updateInstance(values))}
            >
              <InstanceConnectionFields
                form={editForm}
                idPrefix="instance-edit"
                isAllowSelfSignedDisabled={isEditAllowSelfSignedDisabled}
                messages={messages}
                passwordDescription={messages.forms.instances.edit.passwordDescription}
              />
              {editSaveError ? (
                <Alert variant="destructive">
                  <AlertTitle>{messages.forms.instances.edit.validationFailedTitle}</AlertTitle>
                  <AlertDescription>{editSaveError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleEditOpenChange(false)}>
                  {messages.forms.instances.edit.cancel}
                </Button>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting
                    ? messages.forms.instances.edit.submitLoading
                    : messages.forms.instances.edit.submitIdle}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
