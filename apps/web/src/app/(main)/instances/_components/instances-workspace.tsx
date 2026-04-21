"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, CircleAlert, Info, Pencil, RefreshCw } from "lucide-react";
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
import { StatusToggle } from "@/components/yapd/status-toggle";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  InstanceDetailResponse,
  InstanceInfoResponse,
  InstanceItem,
  InstanceListResponse,
  InstanceMutationResponse,
  InstanceReauthenticateResponse,
  InstanceSyncToggleResponse,
  InstanceTestResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { splitManagedInstanceBaseUrl } from "@/lib/instances/managed-instance-base-url";
import { cn } from "@/lib/utils";

import { CreateInstanceDialog } from "./create-instance-dialog";
import { InstanceConnectionFields } from "./instance-connection-fields";
import {
  buildInstanceFormSchema,
  DEFAULT_INSTANCE_FORM_VALUES,
  type InstanceFormValues,
  toInstanceRequestBody,
} from "./instance-form-schema";
import { InstanceInfoPanel } from "./instance-info-panel";

function inferInstanceErrorKind(message: string | null): NonNullable<InstanceItem["sessionLastErrorKind"]> {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("credential") ||
    normalized.includes("senha") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return "invalid_credentials";
  }

  if (normalized.includes("tls") || normalized.includes("certificate") || normalized.includes("ssl")) {
    return "tls_error";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("abort")) {
    return "timeout";
  }

  if (
    normalized.includes("dns") ||
    normalized.includes("resolve") ||
    normalized.includes("enotfound") ||
    normalized.includes("getaddrinfo")
  ) {
    return "dns_error";
  }

  if (normalized.includes("refused") || normalized.includes("econnrefused")) {
    return "connection_refused";
  }

  if (normalized.includes("payload") || normalized.includes("format") || normalized.includes("/auth")) {
    return "pihole_response_error";
  }

  return "unknown";
}

function resolveInstanceErrorKind(item: Pick<InstanceItem, "sessionLastErrorKind" | "sessionLastErrorMessage">) {
  return item.sessionLastErrorKind ?? inferInstanceErrorKind(item.sessionLastErrorMessage);
}

type InstanceInfoState =
  | {
      status: "idle";
      data: null;
      error: null;
    }
  | {
      status: "loading";
      data: InstanceInfoResponse | null;
      error: null;
    }
  | {
      status: "success";
      data: InstanceInfoResponse;
      error: null;
    }
  | {
      status: "error";
      data: InstanceInfoResponse | null;
      error: string;
    };

const INSTANCE_INFO_INITIAL_STATE: InstanceInfoState = {
  status: "idle",
  data: null,
  error: null,
};

export function InstancesWorkspace({
  initialItems,
}: Readonly<{
  initialItems: InstanceItem[];
}>) {
  const { messages, formatDateTime, locale } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const editInstanceSchema = useMemo(() => buildInstanceFormSchema(messages, { requirePassword: false }), [messages]);
  const [items, setItems] = useState(initialItems);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reauthenticatingId, setReauthenticatingId] = useState<string | null>(null);
  const [syncUpdatingId, setSyncUpdatingId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState<InstanceDetailResponse["instance"] | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [errorDetailsItem, setErrorDetailsItem] = useState<InstanceItem | null>(null);
  const [selectedInfoInstanceId, setSelectedInfoInstanceId] = useState<string | null>(null);
  const [instanceInfoById, setInstanceInfoById] = useState<Record<string, InstanceInfoState>>({});
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

  const getInstanceInfoState = (instanceId: string): InstanceInfoState =>
    instanceInfoById[instanceId] ?? INSTANCE_INFO_INITIAL_STATE;

  const selectedInfoItem = selectedInfoInstanceId
    ? (items.find((item) => item.id === selectedInfoInstanceId) ?? null)
    : null;

  const loadInstanceInfo = async (instanceId: string, options?: { force?: boolean }) => {
    const currentState = instanceInfoById[instanceId] ?? INSTANCE_INFO_INITIAL_STATE;

    if (!options?.force && (currentState.status === "loading" || currentState.status === "success")) {
      return;
    }

    setInstanceInfoById((current) => ({
      ...current,
      [instanceId]: {
        status: "loading",
        data: current[instanceId]?.data ?? null,
        error: null,
      },
    }));

    const { data, response } = await client.GET<InstanceInfoResponse>("/instances/{id}/info", {
      params: {
        path: {
          id: instanceId,
        },
      },
    });

    if (!response.ok || !data) {
      const message = await getApiErrorMessage(response);
      setInstanceInfoById((current) => ({
        ...current,
        [instanceId]: {
          status: "error",
          data: current[instanceId]?.data ?? null,
          error: message,
        },
      }));
      return;
    }

    setInstanceInfoById((current) => ({
      ...current,
      [instanceId]: {
        status: "success",
        data,
        error: null,
      },
    }));
  };

  const openInfoDialog = (instanceId: string) => {
    setSelectedInfoInstanceId(instanceId);
    void loadInstanceInfo(instanceId);
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
    const splitBaseUrl = splitManagedInstanceBaseUrl(data.instance.baseUrl);

    if (!splitBaseUrl) {
      setIsEditLoading(false);
      setEditLoadError(messages.forms.instances.validation.baseUrl);
      return;
    }

    editForm.reset({
      name: data.instance.name,
      scheme: splitBaseUrl.scheme,
      hostPath: splitBaseUrl.hostPath,
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

    const updatedInstanceId = editingInstanceId;
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

    setInstanceInfoById((current) => {
      if (!(updatedInstanceId in current)) {
        return current;
      }

      return {
        ...current,
        [updatedInstanceId]: INSTANCE_INFO_INITIAL_STATE,
      };
    });

    if (selectedInfoInstanceId === updatedInstanceId) {
      void loadInstanceInfo(updatedInstanceId, { force: true });
    }
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

  const updateInstanceSync = async (item: InstanceItem, enabled: boolean) => {
    if (item.isBaseline && !enabled) {
      toast.error(messages.forms.instances.table.syncLocked);
      return;
    }

    setSyncUpdatingId(item.id);
    const { response } = await client.PATCH<InstanceSyncToggleResponse>("/instances/{id}/sync", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      params: {
        path: {
          id: item.id,
        },
      },
      body: {
        enabled,
      },
    });

    setSyncUpdatingId(null);

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(
      enabled
        ? messages.forms.instances.toasts.syncEnabledSuccess
        : messages.forms.instances.toasts.syncDisabledSuccess,
    );
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

  const isRowEditBusy = (instanceId: string) =>
    editingInstanceId === instanceId && (isEditLoading || editForm.formState.isSubmitting);

  const isRowBusy = (instanceId: string) =>
    isRowEditBusy(instanceId) ||
    testingId === instanceId ||
    reauthenticatingId === instanceId ||
    syncUpdatingId === instanceId;

  const getErrorCopy = (item: Pick<InstanceItem, "name" | "sessionLastErrorKind" | "sessionLastErrorMessage">) => {
    const resolvedKind = resolveInstanceErrorKind(item);

    return {
      ...messages.forms.instances.errorDetails[resolvedKind],
      technicalDetails:
        item.sessionLastErrorMessage?.trim() || messages.forms.instances.errorDetails.noTechnicalDetails,
    };
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="hidden sm:block" aria-hidden />
            <div className="space-y-1.5 text-center">
              <CardTitle>{messages.forms.instances.table.title}</CardTitle>
              <CardDescription>{messages.forms.instances.table.description}</CardDescription>
            </div>
            <div className="sm:justify-self-end">
              <CreateInstanceDialog onCreated={refreshItems} />
            </div>
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
                  <TableHead>{messages.forms.instances.table.sync}</TableHead>
                  <TableHead>{messages.forms.instances.table.lastError}</TableHead>
                  <TableHead className="text-right">{messages.forms.instances.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.isBaseline ? (
                            <Badge variant="outline">{messages.forms.instances.table.baselineBadge}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.baseUrl}</TableCell>
                      <TableCell>{item.trustMode}</TableCell>
                      <TableCell>{item.lastKnownVersion ?? messages.common.versionUnavailable}</TableCell>
                      <TableCell>
                        {item.lastValidatedAt
                          ? formatDateTime(item.lastValidatedAt)
                          : messages.common.versionUnavailable}
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant={getSessionStatusVariant(item.sessionStatus)}>
                            {getSessionStatusLabel(item.sessionStatus)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.sessionValidUntil
                          ? formatDateTime(item.sessionValidUntil)
                          : messages.common.versionUnavailable}
                      </TableCell>
                      <TableCell>
                        <div title={item.isBaseline ? messages.forms.instances.table.syncLocked : undefined}>
                          <StatusToggle
                            checked={item.syncEnabled}
                            disabled={item.isBaseline || isRowBusy(item.id)}
                            activeLabel={
                              syncUpdatingId === item.id && item.syncEnabled
                                ? messages.forms.instances.table.syncDisabling
                                : messages.forms.instances.table.syncEnabled
                            }
                            inactiveLabel={
                              syncUpdatingId === item.id && !item.syncEnabled
                                ? messages.forms.instances.table.syncEnabling
                                : messages.forms.instances.table.syncDisabled
                            }
                            onCheckedChange={(checked) => void updateInstanceSync(item, checked)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-72 items-start gap-2 text-sm">
                          <span className={cn(!item.sessionLastErrorMessage && "text-muted-foreground")}>
                            {item.sessionLastErrorMessage
                              ? getErrorCopy(item).title
                              : messages.common.versionUnavailable}
                          </span>
                          {item.sessionLastErrorMessage ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={messages.forms.instances.table.errorDetails}
                              title={messages.forms.instances.table.errorDetails}
                              onClick={() => setErrorDetailsItem(item)}
                            >
                              <CircleAlert />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={messages.forms.instances.table.editIdle}
                            title={messages.forms.instances.table.editIdle}
                            disabled={isRowBusy(item.id)}
                            onClick={() => openEditDialog(item.id)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={messages.forms.instances.table.infoIdle}
                            title={messages.forms.instances.table.infoIdle}
                            disabled={isRowBusy(item.id)}
                            onClick={() => openInfoDialog(item.id)}
                          >
                            <Info />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={messages.forms.instances.table.testIdle}
                            title={messages.forms.instances.table.testIdle}
                            disabled={isRowBusy(item.id)}
                            onClick={() => void testInstance(item.id)}
                          >
                            <Activity className={cn(testingId === item.id && "animate-pulse")} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={messages.forms.instances.table.reauthenticateIdle}
                            title={messages.forms.instances.table.reauthenticateIdle}
                            disabled={isRowBusy(item.id)}
                            onClick={() => void reauthenticateInstance(item.id)}
                          >
                            <RefreshCw className={cn(reauthenticatingId === item.id && "animate-spin")} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog open={Boolean(selectedInfoInstanceId)} onOpenChange={(open) => !open && setSelectedInfoInstanceId(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{messages.forms.instances.info.title}</DialogTitle>
            <DialogDescription>
              {selectedInfoItem
                ? messages.forms.instances.info.description(selectedInfoItem.name)
                : messages.forms.instances.info.descriptionFallback}
            </DialogDescription>
          </DialogHeader>

          {selectedInfoInstanceId ? (
            <InstanceInfoPanel
              error={getInstanceInfoState(selectedInfoInstanceId).error}
              info={getInstanceInfoState(selectedInfoInstanceId).data}
              isLoading={getInstanceInfoState(selectedInfoInstanceId).status === "loading"}
              locale={locale}
              messages={messages}
              onRetry={() => {
                void loadInstanceInfo(selectedInfoInstanceId, { force: true });
              }}
              formatDateTime={formatDateTime}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(errorDetailsItem)} onOpenChange={(open) => !open && setErrorDetailsItem(null)}>
        <DialogContent className="sm:max-w-xl">
          {errorDetailsItem ? (
            <>
              <DialogHeader>
                <DialogTitle>{messages.forms.instances.errorDetails.title}</DialogTitle>
                <DialogDescription>
                  {messages.forms.instances.errorDetails.description(errorDetailsItem.name)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">{messages.forms.instances.errorDetails.summary}</p>
                  <p className="font-medium">{getErrorCopy(errorDetailsItem).title}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">{messages.forms.instances.errorDetails.possibleCause}</p>
                  <p className="text-sm leading-6">{getErrorCopy(errorDetailsItem).cause}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">{messages.forms.instances.errorDetails.whatToCheck}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                    {getErrorCopy(errorDetailsItem).checks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">
                    {messages.forms.instances.errorDetails.technicalDetails}
                  </p>
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 font-mono text-xs leading-6">
                    {getErrorCopy(errorDetailsItem).technicalDetails}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setErrorDetailsItem(null)}>
                  {messages.forms.instances.errorDetails.close}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
