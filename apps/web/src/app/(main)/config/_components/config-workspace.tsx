"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Database,
  Download,
  FileStack,
  Globe,
  Link2,
  Network,
  RefreshCw,
  Router,
  ScanSearch,
  ServerCog,
  ShieldEllipsis,
} from "lucide-react";
import { toast } from "sonner";

import { ManagedItemsPartialAlert } from "@/app/(main)/_components/managed-items-partial-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { StatusToggle } from "@/components/yapd/status-toggle";
import { getBrowserApiBaseUrl } from "@/lib/api/base-url";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  ConfigFieldItem,
  ConfigIgnoreRuleResponse,
  ConfigMutationResponse,
  ConfigOverviewResponse,
  ConfigTopicData,
  ConfigTopicName,
  ConfigUpdateResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type TopicDraft = Record<string, string | boolean>;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildInitialDraft(topic: ConfigTopicData): TopicDraft {
  return Object.fromEntries(
    topic.fields.map((field) => {
      if (typeof field.value === "boolean") {
        return [field.path, field.value];
      }

      if (typeof field.value === "string") {
        return [field.path, field.value];
      }

      return [field.path, JSON.stringify(field.value, null, 2)];
    }),
  );
}

function buildDraftMap(data: ConfigOverviewResponse): Record<string, TopicDraft> {
  return Object.fromEntries(data.topics.map((topic) => [topic.name, buildInitialDraft(topic)]));
}

function setValueAtPath(target: unknown, path: string, value: unknown) {
  if (!target || typeof target !== "object") {
    return;
  }

  const segments = path.split(".");
  let current = target as Record<string, unknown>;

  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }

    const next = current[segment];

    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }
}

function parseFieldDraft(field: ConfigFieldItem, draftValue: string | boolean): unknown {
  if (typeof field.value === "boolean") {
    return draftValue === true;
  }

  if (typeof field.value === "string") {
    return String(draftValue);
  }

  if (typeof draftValue !== "string") {
    throw new Error(`Invalid draft for ${field.path}`);
  }

  const rawValue = draftValue.trim();

  if (rawValue.length === 0) {
    return field.value === null ? null : "";
  }

  return JSON.parse(rawValue) as unknown;
}

function buildTopicPayload(topic: ConfigTopicData, draft: TopicDraft) {
  const base =
    topic.value && typeof topic.value === "object" ? JSON.parse(JSON.stringify(topic.value)) : (topic.value ?? {});

  for (const field of topic.fields) {
    setValueAtPath(base, field.path, parseFieldDraft(field, draft[field.path] ?? ""));
  }

  return base;
}

function groupFields(fields: ConfigFieldItem[]) {
  const groups = new Map<string, ConfigFieldItem[]>();

  for (const field of fields) {
    const groupName = field.groupPath ?? "_root";
    const current = groups.get(groupName) ?? [];
    current.push(field);
    groups.set(groupName, current);
  }

  return [...groups.entries()];
}

function getFieldDomId(topic: ConfigTopicName, fieldPath: string) {
  return `config-field-${topic}-${encodeURIComponent(fieldPath).replaceAll("%", "_")}`;
}

const TOPIC_ICONS: Record<ConfigTopicName, LucideIcon> = {
  dns: Globe,
  dhcp: Router,
  ntp: Network,
  resolver: ScanSearch,
  database: Database,
  webserver: ServerCog,
  files: FileStack,
  misc: ShieldEllipsis,
  debug: Bug,
};

export function ConfigWorkspace({ initialData }: Readonly<{ initialData: ConfigOverviewResponse }>) {
  const { messages } = useWebI18n();
  const { csrfToken } = useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const [data, setData] = useState(initialData);
  const [drafts, setDrafts] = useState<Record<string, TopicDraft>>(() => buildDraftMap(initialData));
  const [sourceInstanceId, setSourceInstanceId] = useState(initialData.source.defaultSourceInstanceId);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [syncDialogTopic, setSyncDialogTopic] = useState<ConfigTopicData | null>(null);
  const [syncSourceInstanceId, setSyncSourceInstanceId] = useState(initialData.source.defaultSourceInstanceId);
  const [syncTargetInstanceIds, setSyncTargetInstanceIds] = useState<string[]>([]);
  const [highlightedFieldPath, setHighlightedFieldPath] = useState<string | null>(null);

  const requestedTab = searchParams.get("tab");
  const requestedFieldPath = searchParams.get("field");
  const activeTopic: ConfigTopicName =
    data.topics.find((topic) => topic.name === requestedTab)?.name ?? initialData.topics[0]?.name ?? "dns";

  const activeTopicData = data.topics.find((topic) => topic.name === activeTopic) ?? null;
  const activeDraft = activeTopicData ? (drafts[activeTopicData.name] ?? buildInitialDraft(activeTopicData)) : {};
  const driftItems = data.driftItems;
  const isReloading = busyAction === "refresh";
  const isDownloading = busyAction === "download";
  const isSyncing = syncDialogTopic !== null && busyAction === `sync:${syncDialogTopic.name}`;

  const updateQueryState = useCallback(
    (
      nextTopic: ConfigTopicName,
      options?: {
        fieldPath?: string | null;
        replace?: boolean;
      },
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", nextTopic);

      if (options?.fieldPath) {
        params.set("field", options.fieldPath);
      } else {
        params.delete("field");
      }

      const url = `${pathname}?${params.toString()}`;

      if (options?.replace) {
        router.replace(url, { scroll: false });
        return;
      }

      router.push(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeTopicDirty = useMemo(() => {
    if (!activeTopicData) {
      return false;
    }

    try {
      return (
        stableSerialize(buildTopicPayload(activeTopicData, activeDraft)) !== stableSerialize(activeTopicData.value)
      );
    } catch {
      return true;
    }
  }, [activeDraft, activeTopicData]);

  useEffect(() => {
    if (requestedTab !== activeTopic) {
      updateQueryState(activeTopic, {
        fieldPath: requestedFieldPath,
        replace: true,
      });
    }
  }, [activeTopic, requestedFieldPath, requestedTab, updateQueryState]);

  useEffect(() => {
    if (!requestedFieldPath || !activeTopicData) {
      setHighlightedFieldPath(null);
      return;
    }

    if (!activeTopicData.fields.some((field) => field.path === requestedFieldPath)) {
      toast.error(messages.config.focusInvalid);
      updateQueryState(activeTopic, {
        fieldPath: null,
        replace: true,
      });
      return;
    }

    const element = document.getElementById(getFieldDomId(activeTopic, requestedFieldPath));

    if (!element) {
      return;
    }

    setHighlightedFieldPath(requestedFieldPath);
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeoutId = window.setTimeout(
      () => setHighlightedFieldPath((current) => (current === requestedFieldPath ? null : current)),
      2200,
    );
    return () => window.clearTimeout(timeoutId);
  }, [activeTopic, activeTopicData, messages.config.focusInvalid, requestedFieldPath, updateQueryState]);

  const refreshConfig = async () => {
    setBusyAction("refresh");

    try {
      const { data: nextData, response } = await client.GET<ConfigOverviewResponse>("/config");

      if (!response.ok || !nextData) {
        toast.error(messages.config.loadFailed);
        return;
      }

      setData(nextData);
      setDrafts(buildDraftMap(nextData));
      setSourceInstanceId(nextData.source.defaultSourceInstanceId);
    } finally {
      setBusyAction(null);
    }
  };

  const handleTabChange = (nextTopic: string) => {
    const normalizedTopic = nextTopic as ConfigTopicName;

    if (!activeTopicData || normalizedTopic === activeTopic) {
      return;
    }

    if (activeTopicDirty && !window.confirm(messages.config.unsavedChanges)) {
      return;
    }

    updateQueryState(normalizedTopic);
  };

  const handleDraftChange = (topicName: ConfigTopicName, field: ConfigFieldItem, value: string | boolean) => {
    setDrafts((current) => ({
      ...current,
      [topicName]: {
        ...(current[topicName] ?? {}),
        [field.path]: value,
      },
    }));
  };

  const discardTopic = (topic: ConfigTopicData) => {
    setDrafts((current) => ({
      ...current,
      [topic.name]: buildInitialDraft(topic),
    }));
  };

  const saveTopic = async (topic: ConfigTopicData, draft: TopicDraft) => {
    let topicPayload: unknown;

    try {
      topicPayload = buildTopicPayload(topic, draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : messages.config.loadFailed);
      return;
    }

    setBusyAction(`save:${topic.name}`);

    try {
      const { data: responseData, response } = await client.PATCH<ConfigUpdateResponse>(`/config/${topic.name}`, {
        headers: {
          "x-yapd-csrf": csrfToken,
        },
        body: {
          sourceInstanceId,
          config: {
            [topic.name]: topicPayload,
          },
        },
      });

      if (!response.ok || !responseData) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      toast.success(messages.config.saveSuccess);
      await refreshConfig();
    } finally {
      setBusyAction(null);
    }
  };

  const setIgnoreRule = async (field: ConfigFieldItem, topicName: ConfigTopicName, ignored: boolean) => {
    const actionKey = `${ignored ? "ignore" : "unignore"}:${topicName}:${field.path}`;
    setBusyAction(actionKey);

    try {
      const request = ignored
        ? client.POST<ConfigIgnoreRuleResponse>("/config/ignored-fields", {
            headers: {
              "x-yapd-csrf": csrfToken,
            },
            body: {
              topic: topicName,
              fieldPath: field.path,
            },
          })
        : client.DELETE<ConfigIgnoreRuleResponse>("/config/ignored-fields/{topic}/{fieldPath}", {
            headers: {
              "x-yapd-csrf": csrfToken,
            },
            params: {
              path: {
                topic: topicName,
                fieldPath: field.path,
              },
            },
          });

      const { data: responseData, response } = await request;

      if (!response.ok || !responseData) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      toast.success(ignored ? messages.config.ignoreSuccess : messages.config.unignoreSuccess);
      await refreshConfig();
    } finally {
      setBusyAction(null);
    }
  };

  const openSyncDialog = (topic: ConfigTopicData) => {
    setSyncDialogTopic(topic);
    setSyncSourceInstanceId(sourceInstanceId);
    setSyncTargetInstanceIds(
      data.instances
        .filter(
          (instance) =>
            instance.instanceId !== sourceInstanceId &&
            !data.unavailableInstances.some((candidate) => candidate.instanceId === instance.instanceId),
        )
        .map((instance) => instance.instanceId),
    );
  };

  const closeSyncDialog = () => {
    if (isSyncing) {
      return;
    }

    setSyncDialogTopic(null);
    setSyncTargetInstanceIds([]);
  };

  const submitSync = async () => {
    if (!syncDialogTopic) {
      return;
    }

    if (syncTargetInstanceIds.length === 0) {
      toast.error(messages.config.syncDialog.targetsRequired);
      return;
    }

    setBusyAction(`sync:${syncDialogTopic.name}`);

    try {
      const { data: responseData, response } = await client.POST<ConfigMutationResponse>(
        `/config/${syncDialogTopic.name}/sync`,
        {
          headers: {
            "x-yapd-csrf": csrfToken,
          },
          body: {
            sourceInstanceId: syncSourceInstanceId,
            targetInstanceIds: syncTargetInstanceIds,
          },
        },
      );

      if (!response.ok || !responseData) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      if (responseData.status === "partial") {
        toast.warning(
          messages.config.partialSync(responseData.summary.successfulCount, responseData.summary.failedCount),
        );
      } else {
        toast.success(messages.config.syncSuccess(responseData.summary.successfulCount));
      }

      closeSyncDialog();
      await refreshConfig();
    } finally {
      setBusyAction(null);
    }
  };

  const downloadTeleporter = async () => {
    setBusyAction("download");

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/config/teleporter/export?instanceId=${encodeURIComponent(sourceInstanceId)}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(messages.config.downloadFailed);
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filenameMatch?.[1] ?? "pihole-teleporter.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      toast.error(messages.config.downloadFailed);
    } finally {
      setBusyAction(null);
    }
  };

  if (!activeTopicData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{messages.config.title}</CardTitle>
            <CardDescription>{messages.config.editSourceHint}</CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field className="min-w-64">
              <FieldLabel>{messages.config.sourceLabel}</FieldLabel>
              <Select value={sourceInstanceId} onValueChange={setSourceInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder={messages.config.sourcePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {data.instances.map((instance) => (
                    <SelectItem key={instance.instanceId} value={instance.instanceId}>
                      {instance.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void refreshConfig()}
                disabled={isReloading || busyAction !== null}
              >
                <RefreshCw className={isReloading ? "animate-spin" : ""} />
                {messages.common.retry}
              </Button>
              <Button onClick={() => void downloadTeleporter()} disabled={busyAction !== null}>
                <Download />
                {isDownloading ? messages.config.teleporterDownloading : messages.config.teleporterDownload}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {data.unavailableInstances.length > 0 ? (
        <ManagedItemsPartialAlert
          title={messages.config.unavailableTitle}
          description={messages.config.unavailableDescription(
            data.unavailableInstances.length,
            data.source.totalInstances,
          )}
        />
      ) : null}

      {driftItems.length > 0 ? (
        <Alert>
          <AlertTitle>{messages.config.driftTitle}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{messages.config.driftDescription(driftItems.length)}</p>
            <div className="flex flex-wrap gap-2">
              {driftItems.map((item) => (
                <Button key={`${item.topic}:${item.fieldPath}`} asChild variant="outline" size="sm">
                  <Link
                    href={`${pathname}?tab=${item.topic}&field=${encodeURIComponent(item.fieldPath)}`}
                    scroll={false}
                  >
                    <Link2 className="size-3.5" />
                    {messages.config.driftLinkLabel(item.topicTitle, item.fieldPath)}
                  </Link>
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTopic} onValueChange={handleTabChange} className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {data.topics.map((topic) => {
            const Icon = TOPIC_ICONS[topic.name];

            return (
              <TabsTrigger key={topic.name} value={topic.name} className="gap-2">
                <Icon className="size-4" />
                <span>{topic.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {data.topics.map((topic) => (
          <TabsContent key={topic.name} value={topic.name} className="space-y-6">
            {(() => {
              const topicDraft = drafts[topic.name] ?? buildInitialDraft(topic);
              const fieldGroups = groupFields(topic.fields);
              const isSaving = busyAction === `save:${topic.name}`;
              const topicDirty = (() => {
                try {
                  return stableSerialize(buildTopicPayload(topic, topicDraft)) !== stableSerialize(topic.value);
                } catch {
                  return true;
                }
              })();

              return (
                <Card>
                  <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle>{topic.title}</CardTitle>
                      <CardDescription>{topic.description ?? messages.config.noDescription}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => discardTopic(topic)}
                        disabled={!topicDirty || busyAction !== null}
                      >
                        {messages.config.discard}
                      </Button>
                      <Button variant="outline" onClick={() => openSyncDialog(topic)} disabled={busyAction !== null}>
                        {messages.config.sync}
                      </Button>
                      <Button
                        onClick={() => void saveTopic(topic, topicDraft)}
                        disabled={!topicDirty || busyAction !== null}
                      >
                        {isSaving ? messages.config.saving : messages.config.save}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground text-sm">{messages.config.jsonHint}</p>

                    {fieldGroups.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{messages.config.empty}</p>
                    ) : null}

                    {fieldGroups.map(([groupName, fields]) => (
                      <div key={groupName} className="space-y-4">
                        {groupName !== "_root" ? (
                          <div>
                            <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-[0.08em]">
                              {groupName}
                            </h3>
                          </div>
                        ) : null}

                        <div className="grid gap-4 xl:grid-cols-2">
                          {fields.map((field) => {
                            const draftValue =
                              topicDraft[field.path] ?? (typeof field.value === "boolean" ? false : "");
                            const isFieldDrifted = field.sync.status !== "synced" && !field.isIgnored;
                            const isFieldFocused = highlightedFieldPath === field.path && activeTopic === topic.name;
                            const isIgnoring = busyAction === `ignore:${topic.name}:${field.path}`;
                            const isUnignoring = busyAction === `unignore:${topic.name}:${field.path}`;

                            return (
                              <Card
                                key={field.path}
                                id={getFieldDomId(topic.name, field.path)}
                                className={cn(
                                  "border-dashed",
                                  isFieldDrifted &&
                                    "border-amber-800 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30",
                                  isFieldFocused && "ring-2 ring-sky-500/60 ring-offset-2 transition-shadow",
                                )}
                              >
                                <CardHeader className="pb-3">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <CardTitle className="text-base">{field.key}</CardTitle>
                                      <CardDescription className="break-all font-mono text-xs">
                                        {messages.config.fieldPath}: {field.path}
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {field.isIgnored ? (
                                        <Badge variant="secondary">{messages.config.ignored}</Badge>
                                      ) : null}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void setIgnoreRule(field, topic.name, !field.isIgnored)}
                                        disabled={busyAction !== null}
                                      >
                                        {field.isIgnored
                                          ? isUnignoring
                                            ? messages.config.unignoring
                                            : messages.config.unignore
                                          : isIgnoring
                                            ? messages.config.ignoring
                                            : messages.config.ignore}
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  {typeof field.value === "boolean" ? (
                                    <StatusToggle
                                      activeLabel={messages.config.booleanActive}
                                      inactiveLabel={messages.config.booleanInactive}
                                      checked={draftValue === true}
                                      onCheckedChange={(checked) => handleDraftChange(topic.name, field, checked)}
                                      disabled={busyAction !== null}
                                    />
                                  ) : (
                                    <Field>
                                      <FieldLabel>{field.key}</FieldLabel>
                                      <Textarea
                                        rows={Math.max(4, String(draftValue).split("\n").length + 1)}
                                        value={String(draftValue)}
                                        onChange={(event) => handleDraftChange(topic.name, field, event.target.value)}
                                        disabled={busyAction !== null}
                                        className="font-mono text-xs"
                                      />
                                      <FieldDescription>{messages.config.jsonHint}</FieldDescription>
                                    </Field>
                                  )}

                                  <div className="space-y-2 text-sm">
                                    <p>
                                      <span className="font-medium">{messages.config.fieldType}:</span>{" "}
                                      <span className="text-muted-foreground">{field.type ?? "-"}</span>
                                    </p>
                                    <p>
                                      <span className="font-medium">{messages.config.fieldDefault}:</span>{" "}
                                      <span className="break-all text-muted-foreground">
                                        {typeof field.defaultValue === "string"
                                          ? field.defaultValue || '""'
                                          : JSON.stringify(field.defaultValue)}
                                      </span>
                                    </p>
                                    <p>
                                      <span className="font-medium">{messages.config.fieldAllowed}:</span>{" "}
                                      <span className="break-all text-muted-foreground">
                                        {typeof field.allowed === "string"
                                          ? field.allowed
                                          : JSON.stringify(field.allowed)}
                                      </span>
                                    </p>
                                    <p>
                                      <span className="font-medium">{messages.config.fieldDescription}:</span>{" "}
                                      <span className="text-muted-foreground">
                                        {field.description ?? messages.config.noDescription}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant={field.modified ? "outline" : "secondary"}>
                                      {field.modified ? "modified" : "default"}
                                    </Badge>
                                    <Badge variant={field.flags.restart_dnsmasq ? "outline" : "secondary"}>
                                      {messages.config.restartDnsmasq}
                                    </Badge>
                                    <Badge variant={field.flags.session_reset ? "outline" : "secondary"}>
                                      {messages.config.sessionReset}
                                    </Badge>
                                    <Badge variant={field.flags.env_var ? "outline" : "secondary"}>
                                      {messages.config.envVar}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={syncDialogTopic !== null} onOpenChange={(open) => (!open ? closeSyncDialog() : undefined)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {syncDialogTopic ? messages.config.syncDialog.title(syncDialogTopic.title) : messages.config.sync}
            </DialogTitle>
            <DialogDescription>{messages.config.syncDialog.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Field>
              <FieldLabel>{messages.config.syncDialog.sourceLabel}</FieldLabel>
              <Select value={syncSourceInstanceId} onValueChange={setSyncSourceInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder={messages.config.syncDialog.sourcePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {data.instances.map((instance) => (
                    <SelectItem key={instance.instanceId} value={instance.instanceId}>
                      {instance.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{messages.config.syncDialog.targetsLabel}</FieldLabel>
              <div className="space-y-3 rounded-md border p-3">
                {data.instances
                  .filter((instance) => instance.instanceId !== syncSourceInstanceId)
                  .map((instance) => {
                    const checked = syncTargetInstanceIds.includes(instance.instanceId);
                    const unavailable = data.unavailableInstances.some(
                      (candidate) => candidate.instanceId === instance.instanceId,
                    );

                    return (
                      <div key={instance.instanceId} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) =>
                              setSyncTargetInstanceIds((current) =>
                                nextChecked === true
                                  ? [...new Set([...current, instance.instanceId])]
                                  : current.filter((item) => item !== instance.instanceId),
                              )
                            }
                            disabled={unavailable || isSyncing}
                          />
                          <span className="text-sm">{instance.instanceName}</span>
                        </div>
                        <div className="flex gap-2">
                          {instance.isBaseline ? (
                            <Badge variant="secondary">{messages.config.syncDialog.baselineBadge}</Badge>
                          ) : null}
                          {unavailable ? (
                            <Badge variant="outline">{messages.config.syncDialog.unavailable}</Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeSyncDialog} disabled={isSyncing}>
              {messages.config.syncDialog.close}
            </Button>
            <Button onClick={() => void submitSync()} disabled={isSyncing}>
              {isSyncing ? messages.config.syncDialog.confirming : messages.config.syncDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
