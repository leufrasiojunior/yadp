"use client";

import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { DiscoverInstanceItem, InstanceItem, InstanceListResponse } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";

export function InstancesWorkspace({
  initialItems,
}: Readonly<{
  initialItems: InstanceItem[];
}>) {
  const { messages, formatDateTime } = useWebI18n();
  const createInstanceSchema = z.object({
    name: z.string().min(2, messages.forms.instances.validation.name),
    baseUrl: z.string().url(messages.forms.instances.validation.baseUrl),
    servicePassword: z.string().min(4, messages.forms.instances.validation.password),
    allowSelfSigned: z.boolean().default(false),
    certificatePem: z.string().optional(),
  });
  const discoverSchema = z.object({
    candidates: z.string().optional(),
  });
  const { csrfToken } = useAppSession();
  const [items, setItems] = useState(initialItems);
  const [createError, setCreateError] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<DiscoverInstanceItem[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reauthenticatingId, setReauthenticatingId] = useState<string | null>(null);
  const client = useMemo(() => getBrowserApiClient(), []);
  const createForm = useForm<z.infer<typeof createInstanceSchema>>({
    resolver: zodResolver(createInstanceSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      servicePassword: "",
      allowSelfSigned: false,
      certificatePem: "",
    },
  });
  const discoverForm = useForm<z.infer<typeof discoverSchema>>({
    resolver: zodResolver(discoverSchema),
    defaultValues: {
      candidates: "https://pi.hole",
    },
  });

  const refreshItems = async () => {
    const { data, response } = await client.GET<InstanceListResponse>("/instances");

    if (!response.ok || !data) {
      toast.error(messages.forms.instances.toasts.refreshFailed);
      return;
    }

    setItems(data.items);
  };

  const createInstance = async (values: z.infer<typeof createInstanceSchema>) => {
    setCreateError(null);
    const { response } = await client.POST("/instances", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        ...values,
        certificatePem: values.certificatePem || undefined,
      },
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response);
      setCreateError(message);
      toast.error(message);
      return;
    }

    setCreateError(null);
    toast.success(messages.forms.instances.toasts.createSuccess);
    createForm.reset();
    await refreshItems();
  };

  const discoverInstances = async (values: z.infer<typeof discoverSchema>) => {
    const candidates = values.candidates
      ?.split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const { data, response } = await client.POST<{ items: DiscoverInstanceItem[] }>("/instances/discover", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        candidates,
      },
    });

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setDiscoveries(data.items);
    toast.success(messages.forms.instances.toasts.discoverSuccess);
  };

  const testInstance = async (instanceId: string) => {
    setTestingId(instanceId);
    const { response } = await client.POST<{ ok: true; version: string; checkedAt: string }>("/instances/{id}/test", {
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
    const { response } = await client.POST<{
      ok: true;
      version: string;
      checkedAt: string;
      sessionStatus: InstanceItem["sessionStatus"];
      sessionLoginAt: string | null;
      sessionLastActiveAt: string | null;
      sessionValidUntil: string | null;
    }>("/instances/{id}/reauthenticate", {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{messages.forms.instances.create.title}</CardTitle>
            <CardDescription>{messages.forms.instances.create.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              className="space-y-6"
              onSubmit={createForm.handleSubmit((values) => void createInstance(values))}
            >
              <FieldGroup className="gap-4">
                <Controller
                  control={createForm.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="instance-name">{messages.forms.instances.create.name}</FieldLabel>
                      <Input
                        {...field}
                        id="instance-name"
                        placeholder="Pi-hole Sala"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="baseUrl"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="instance-url">{messages.forms.instances.create.baseUrl}</FieldLabel>
                      <Input
                        {...field}
                        id="instance-url"
                        placeholder="https://pihole.lan"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="servicePassword"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="instance-password">{messages.forms.instances.create.password}</FieldLabel>
                      <Input
                        {...field}
                        id="instance-password"
                        type="password"
                        placeholder="••••••••"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>{messages.forms.instances.create.passwordDescription}</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="allowSelfSigned"
                  render={({ field, fieldState }) => (
                    <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                      <Checkbox
                        id="instance-self-signed"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="instance-self-signed" className="font-normal">
                          {messages.forms.instances.create.allowSelfSigned}
                        </FieldLabel>
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="certificatePem"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="instance-cert">{messages.forms.instances.create.certificate}</FieldLabel>
                      <Textarea
                        {...field}
                        id="instance-cert"
                        rows={4}
                        placeholder="-----BEGIN CERTIFICATE-----"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
              {createError ? (
                <Alert variant="destructive">
                  <AlertTitle>{messages.forms.instances.create.validationFailedTitle}</AlertTitle>
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting
                  ? messages.forms.instances.create.submitLoading
                  : messages.forms.instances.create.submitIdle}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.forms.instances.discovery.title}</CardTitle>
            <CardDescription>{messages.forms.instances.discovery.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              noValidate
              className="space-y-4"
              onSubmit={discoverForm.handleSubmit((values) => void discoverInstances(values))}
            >
              <Controller
                control={discoverForm.control}
                name="candidates"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="discover-candidates">
                      {messages.forms.instances.discovery.candidates}
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="discover-candidates"
                      rows={6}
                      placeholder={"https://pi.hole\nhttps://pihole.lan"}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>{messages.forms.instances.discovery.candidatesDescription}</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit" variant="outline" disabled={discoverForm.formState.isSubmitting}>
                {discoverForm.formState.isSubmitting
                  ? messages.forms.instances.discovery.submitLoading
                  : messages.forms.instances.discovery.submitIdle}
              </Button>
            </form>

            <div className="space-y-3 text-sm">
              {discoveries.length === 0 ? (
                <p className="text-muted-foreground">{messages.forms.instances.discovery.empty}</p>
              ) : (
                discoveries.map((item) => (
                  <div key={item.baseUrl} className="rounded-xl border p-3">
                    <p className="font-medium">{item.baseUrl}</p>
                    <p className="text-muted-foreground">
                      {item.reachable
                        ? messages.forms.instances.discovery.reachable
                        : (item.error ?? messages.forms.instances.discovery.unreachable)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.forms.instances.table.title}</CardTitle>
          <CardDescription>{messages.forms.instances.table.description}</CardDescription>
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
                        <div className="text-muted-foreground text-xs">{getManagedByLabel(item.sessionManagedBy)}</div>
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
                        disabled={testingId === item.id || reauthenticatingId === item.id}
                        onClick={() => void testInstance(item.id)}
                      >
                        {testingId === item.id
                          ? messages.forms.instances.table.testLoading
                          : messages.forms.instances.table.testIdle}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reauthenticatingId === item.id || testingId === item.id}
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
  );
}
