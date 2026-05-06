"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type { DiscoverInstanceItem, DiscoverInstancesResponse, InstanceMutationResponse } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { splitManagedInstanceBaseUrl } from "@/lib/instances/managed-instance-base-url";
import { cn } from "@/lib/utils";

import { InstanceConnectionFields } from "./instance-connection-fields";
import {
  buildDiscoverySchema,
  buildInstanceFormSchema,
  DEFAULT_INSTANCE_FORM_VALUES,
  type InstanceFormValues,
  parseDiscoveryCandidatesInput,
  toInstanceRequestBody,
} from "./instance-form-schema";

type DiscoveryFormValues = {
  candidates?: string;
};

type CreateInstanceDialogProps = {
  onCreated: () => Promise<void> | void;
};

const DEFAULT_DISCOVERY_FORM_VALUES: DiscoveryFormValues = {
  candidates: "https://pi.hole",
};

export function CreateInstanceDialog({ onCreated }: Readonly<CreateInstanceDialogProps>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const createInstanceSchema = useMemo(() => buildInstanceFormSchema(messages, { requirePassword: true }), [messages]);
  const discoverySchema = useMemo(() => buildDiscoverySchema(messages), [messages]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "discovery">("manual");
  const [createError, setCreateError] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<DiscoverInstanceItem[]>([]);
  const createForm = useForm<InstanceFormValues>({
    resolver: zodResolver(createInstanceSchema),
    defaultValues: DEFAULT_INSTANCE_FORM_VALUES,
  });
  const discoveryForm = useForm<DiscoveryFormValues>({
    resolver: zodResolver(discoverySchema),
    defaultValues: DEFAULT_DISCOVERY_FORM_VALUES,
  });
  const certificatePem = useWatch({
    control: createForm.control,
    name: "certificatePem",
  });
  const allowSelfSigned = useWatch({
    control: createForm.control,
    name: "allowSelfSigned",
  });
  const isAllowSelfSignedDisabled = (certificatePem ?? "").trim().length > 0;
  const isBusy = createForm.formState.isSubmitting || discoveryForm.formState.isSubmitting;

  useEffect(() => {
    if (isAllowSelfSignedDisabled && allowSelfSigned) {
      createForm.setValue("allowSelfSigned", false, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [allowSelfSigned, createForm, isAllowSelfSignedDisabled]);

  const resetDialog = () => {
    setIsOpen(false);
    setActiveTab("manual");
    setCreateError(null);
    setDiscoveries([]);
    createForm.reset(DEFAULT_INSTANCE_FORM_VALUES);
    discoveryForm.reset(DEFAULT_DISCOVERY_FORM_VALUES);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isBusy) {
        return;
      }

      resetDialog();
      return;
    }

    setIsOpen(true);
  };

  const handleTabChange = (nextValue: string) => {
    if (isBusy || (nextValue !== "manual" && nextValue !== "discovery")) {
      return;
    }

    setActiveTab(nextValue);
  };

  const createInstance = async (values: InstanceFormValues) => {
    const parsedValues = createInstanceSchema.safeParse(values);

    if (!parsedValues.success) {
      await createForm.trigger();
      return;
    }

    setCreateError(null);
    const { response } = await client.POST<InstanceMutationResponse>("/instances", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: toInstanceRequestBody(parsedValues.data),
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response);
      setCreateError(message);
      toast.error(message);
      return;
    }

    toast.success(messages.forms.instances.toasts.createSuccess);
    resetDialog();
    await onCreated();
  };

  const discoverInstances = async (values: DiscoveryFormValues) => {
    const parsedValues = discoverySchema.safeParse(values);
    setDiscoveries([]);

    if (!parsedValues.success) {
      await discoveryForm.trigger();
      return;
    }

    const parsedCandidates = parseDiscoveryCandidatesInput(parsedValues.data.candidates);

    if (parsedCandidates.invalidValues.length > 0 || parsedCandidates.exceedsLimit) {
      await discoveryForm.trigger();
      return;
    }

    const { data, response } = await client.POST<DiscoverInstancesResponse>("/instances/discover", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        candidates: parsedCandidates.candidates.length > 0 ? parsedCandidates.candidates : undefined,
      },
    });

    if (!response.ok || !data) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    setDiscoveries(data.items);
    toast.success(messages.forms.instances.toasts.discoverSuccess);
  };

  const applyDiscoveredAddress = (baseUrl: string) => {
    const splitBaseUrl = splitManagedInstanceBaseUrl(baseUrl);

    if (!splitBaseUrl) {
      toast.error(messages.forms.instances.discovery.invalidSelection);
      return;
    }

    setCreateError(null);
    createForm.setValue("scheme", splitBaseUrl.scheme, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    createForm.setValue("hostPath", splitBaseUrl.hostPath, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setActiveTab("manual");
  };

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        {messages.forms.instances.create.openModal}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={!isBusy}>
          <DialogHeader>
            <DialogTitle>{messages.forms.instances.create.title}</DialogTitle>
            <DialogDescription>{messages.forms.instances.create.description}</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" disabled={isBusy}>
                {messages.forms.instances.create.manualTab}
              </TabsTrigger>
              <TabsTrigger value="discovery" disabled={isBusy}>
                {messages.forms.instances.create.discoveryTab}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-6">
              <form
                noValidate
                className="space-y-6"
                onSubmit={createForm.handleSubmit((values) => void createInstance(values))}
              >
                <InstanceConnectionFields
                  form={createForm}
                  idPrefix="instance-create"
                  isAllowSelfSignedDisabled={isAllowSelfSignedDisabled}
                  messages={messages}
                  passwordDescription={messages.forms.instances.create.passwordDescription}
                />
                {createError ? (
                  <Alert variant="destructive">
                    <AlertTitle>{messages.forms.instances.create.validationFailedTitle}</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
                    {messages.forms.instances.create.cancel}
                  </Button>
                  <Button type="submit" disabled={isBusy}>
                    {createForm.formState.isSubmitting
                      ? messages.forms.instances.create.submitLoading
                      : messages.forms.instances.create.submitIdle}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="discovery" className="space-y-6">
              <form
                noValidate
                className="space-y-4"
                onSubmit={discoveryForm.handleSubmit((values) => void discoverInstances(values))}
              >
                <Controller
                  control={discoveryForm.control}
                  name="candidates"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="discover-candidates-modal">
                        {messages.forms.instances.discovery.candidates}
                      </FieldLabel>
                      <Textarea
                        {...field}
                        id="discover-candidates-modal"
                        rows={6}
                        placeholder={"https://pi.hole\nhttps://pihole.lan"}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>
                        {messages.forms.instances.discovery.candidatesDescription(
                          FRONTEND_CONFIG.instances.discoveryCandidateLimit,
                        )}
                      </FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <p className="text-muted-foreground text-sm">{messages.forms.instances.discovery.useAddressHint}</p>
                <Button type="submit" variant="outline" disabled={isBusy}>
                  {discoveryForm.formState.isSubmitting
                    ? messages.forms.instances.discovery.submitLoading
                    : messages.forms.instances.discovery.submitIdle}
                </Button>
              </form>

              <div className="space-y-3 text-sm">
                {discoveries.length === 0 ? (
                  <p className="text-muted-foreground">{messages.forms.instances.discovery.empty}</p>
                ) : (
                  discoveries.map((item) => (
                    <div
                      key={item.baseUrl}
                      className={cn(
                        "rounded-xl border p-3",
                        item.reachable ? "border-primary/30 bg-primary/5" : "border-border",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{item.baseUrl}</p>
                          <p className="text-muted-foreground">
                            {item.reachable
                              ? messages.forms.instances.discovery.reachable
                              : (item.error ?? messages.forms.instances.discovery.unreachable)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy || !item.reachable}
                          onClick={() => applyDiscoveredAddress(item.baseUrl)}
                        >
                          {messages.forms.instances.discovery.useDiscoveredAddress}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
                  {messages.forms.instances.create.cancel}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
