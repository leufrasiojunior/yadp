"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Clock3,
  Ellipsis,
  Fingerprint,
  History,
  Info,
  type LucideIcon,
  MessageSquareText,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Server,
  Tags,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ClientsPagination } from "@/app/(main)/clients/_components/clients-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { FRONTEND_CONFIG } from "@/config/frontend-config";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  ClientInstanceDetail,
  ClientListItem,
  ClientsListResponse,
  ClientsMutationResponse,
  ClientsSortDirection,
  ClientsSortField,
  GroupItem,
} from "@/lib/api/yapd-types";
import {
  DEFAULT_CLIENTS_SORT_DIRECTION,
  DEFAULT_CLIENTS_SORT_FIELD,
  getDefaultClientsSortDirection,
} from "@/lib/clients/clients-sorting";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type ClientsWorkspaceProps = {
  initialData: ClientsListResponse;
  initialGroups: GroupItem[];
};

type DetailsDialogTab = "overview" | "groups" | "instances";

const TABLE_SKELETON_ROW_KEYS = [
  "clients-skeleton-1",
  "clients-skeleton-2",
  "clients-skeleton-3",
  "clients-skeleton-4",
  "clients-skeleton-5",
  "clients-skeleton-6",
] as const;

function sortNumberArray(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

function areNumberArraysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildFailureToastId(prefix: string, clientHwaddr: string, instanceId: string) {
  return `${prefix}-${clientHwaddr}-${instanceId}`;
}

function getClientPrimaryIp(item: Pick<ClientListItem, "ips">) {
  return item.ips.find((ip) => ip.trim().length > 0) ?? null;
}

function getClientDisplayValue(item: ClientListItem) {
  const alias = item.alias?.trim() ?? "";
  const ip = getClientPrimaryIp(item);

  if (alias.length > 0 && ip) {
    return `${alias}(${ip})`;
  }

  if (alias.length > 0) {
    return alias;
  }

  if (ip) {
    return ip;
  }

  return null;
}

function getClientDialogValue(item: ClientListItem) {
  return getClientDisplayValue(item) ?? item.hwaddr;
}

type SubmitClientChangesOptions = {
  groupIds: number[];
  alias?: string;
  comment?: string;
  retryInstanceId?: string;
  keepDetailsDialogOpen?: boolean;
};

type ReadonlyFieldProps = {
  label: string;
  value: string;
  className?: string;
  multiline?: boolean;
  icon?: LucideIcon;
};

function formatListValue(values: string[], emptyValue: string) {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return emptyValue;
  }

  return normalized.join(", ");
}

function ReadonlyField({ label, value, className, multiline = false, icon: Icon }: Readonly<ReadonlyFieldProps>) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {Icon ? <Icon className="size-3.5" /> : null}
        <span>{label}</span>
      </Label>
      {multiline ? (
        <Textarea value={value} readOnly className="min-h-20 resize-none bg-muted/20" />
      ) : (
        <Input value={value} readOnly className="bg-muted/20" />
      )}
    </div>
  );
}

export function ClientsWorkspace({ initialData, initialGroups }: Readonly<ClientsWorkspaceProps>) {
  const client = useMemo(() => getBrowserApiClient(), []);
  const { csrfToken } = useAppSession();
  const { locale, messages, formatFullDateTime } = useWebI18n();
  const [data, setData] = useState(initialData);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<ClientsSortField>(DEFAULT_CLIENTS_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<ClientsSortDirection>(DEFAULT_CLIENTS_SORT_DIRECTION);
  const [openGroupEditorHwaddr, setOpenGroupEditorHwaddr] = useState<string | null>(null);
  const [draftGroupIds, setDraftGroupIds] = useState<number[]>([]);
  const [instancesDialogClient, setInstancesDialogClient] = useState<ClientListItem | null>(null);
  const [detailsDialogClient, setDetailsDialogClient] = useState<ClientListItem | null>(null);
  const [detailsDialogTab, setDetailsDialogTab] = useState<DetailsDialogTab>("overview");
  const [detailsAliasDraft, setDetailsAliasDraft] = useState("");
  const [detailsCommentDraft, setDetailsCommentDraft] = useState("");
  const [detailsDraftGroupIds, setDetailsDraftGroupIds] = useState<number[]>([]);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const groupNamesById = useMemo(() => new Map(initialGroups.map((group) => [group.id, group.name])), [initialGroups]);

  const isReloading =
    busyAction === "refresh" ||
    busyAction === "page" ||
    busyAction === "page-size" ||
    busyAction === "sort" ||
    busyAction === "search";

  const refreshClients = useCallback(
    async (
      page = data.pagination.page,
      pageSize = data.pagination.pageSize,
      nextSortBy = sortBy,
      nextSortDirection = sortDirection,
      nextSearchTerm = searchTerm,
    ) => {
      const { data: nextData, response } = await client.GET<ClientsListResponse>("/clients", {
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
        toast.error(messages.clients.toasts.refreshFailed);
        return null;
      }

      setData(nextData);
      return nextData;
    },
    [
      client,
      data.pagination.page,
      data.pagination.pageSize,
      messages.clients.toasts.refreshFailed,
      searchTerm,
      sortBy,
      sortDirection,
    ],
  );

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
          const nextData = await refreshClients(1, data.pagination.pageSize, sortBy, sortDirection, nextSearchTerm);

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
    }, FRONTEND_CONFIG.clients.searchDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [data.pagination.pageSize, refreshClients, searchDraft, searchTerm, sortBy, sortDirection]);

  const runRefresh = async () => {
    setBusyAction("refresh");

    try {
      await refreshClients();
    } finally {
      setBusyAction(null);
    }
  };

  const changePageSize = async (nextPageSize: number) => {
    setBusyAction("page-size");

    try {
      await refreshClients(1, nextPageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const goToPage = async (page: number) => {
    setBusyAction("page");

    try {
      await refreshClients(page, data.pagination.pageSize);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSort = async (field: ClientsSortField) => {
    const nextSortDirection =
      sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : getDefaultClientsSortDirection(field);

    setBusyAction("sort");

    try {
      const nextData = await refreshClients(1, data.pagination.pageSize, field, nextSortDirection);

      if (!nextData) {
        return;
      }

      setSortBy(field);
      setSortDirection(nextSortDirection);
    } finally {
      setBusyAction(null);
    }
  };

  const resolveGroupLabels = (item: ClientListItem) => {
    if (item.groupNames.length > 0) {
      return item.groupNames;
    }

    return item.groupIds
      .map((groupId) => groupNamesById.get(groupId))
      .filter((groupName): groupName is string => Boolean(groupName));
  };

  const openGroupEditor = (item: ClientListItem) => {
    if (busyAction !== null) {
      return;
    }

    setOpenGroupEditorHwaddr(item.hwaddr);
    setDraftGroupIds(sortNumberArray(item.groupIds));
  };

  const closeGroupEditor = () => {
    if (busyAction?.startsWith("save:")) {
      return;
    }

    setOpenGroupEditorHwaddr(null);
    setDraftGroupIds([]);
  };

  const openDetailsDialog = (item: ClientListItem) => {
    if (busyAction !== null) {
      return;
    }

    setDetailsDialogClient(item);
    setDetailsDialogTab("overview");
    setDetailsAliasDraft(item.alias ?? "");
    setDetailsCommentDraft(item.comment ?? "");
    setDetailsDraftGroupIds(sortNumberArray(item.groupIds));
  };

  const closeDetailsDialog = () => {
    if (detailsDialogClient && (busyAction?.startsWith(`save:${detailsDialogClient.hwaddr}`) ?? false)) {
      return;
    }

    setDetailsDialogClient(null);
    setDetailsDialogTab("overview");
    setDetailsAliasDraft("");
    setDetailsCommentDraft("");
    setDetailsDraftGroupIds([]);
  };

  const toggleDraftGroup = (groupId: number, checked: boolean) => {
    setDraftGroupIds((current) => {
      const next = checked ? [...new Set([...current, groupId])] : current.filter((value) => value !== groupId);
      return sortNumberArray(next);
    });
  };

  const toggleDetailsDraftGroup = (groupId: number, checked: boolean) => {
    setDetailsDraftGroupIds((current) => {
      const next = checked ? [...new Set([...current, groupId])] : current.filter((value) => value !== groupId);
      return sortNumberArray(next);
    });
  };

  const submitClientChanges = async (item: ClientListItem, options: SubmitClientChangesOptions) => {
    const sortedGroupIds = sortNumberArray(options.groupIds);
    const normalizedAlias = options.alias === undefined ? undefined : options.alias.trim();
    const normalizedComment = options.comment === undefined ? undefined : options.comment.trim();

    if (sortedGroupIds.length === 0 && normalizedAlias === undefined && normalizedComment === undefined) {
      toast.error(messages.clients.table.groupsRequired);
      return;
    }

    setBusyAction(options.retryInstanceId ? `save:${item.hwaddr}:${options.retryInstanceId}` : `save:${item.hwaddr}`);

    const { data: responseData, response } = await client.POST<ClientsMutationResponse>("/clients", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {
        client: [item.hwaddr],
        ...(sortedGroupIds.length > 0 ? { groups: sortedGroupIds } : {}),
        ...(normalizedAlias !== undefined ? { alias: normalizedAlias } : {}),
        ...(normalizedComment !== undefined ? { comment: normalizedComment } : {}),
        ...(options.retryInstanceId ? { targetInstanceIds: [options.retryInstanceId] } : {}),
      },
    });

    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    if (responseData.failedInstances.length === 0) {
      toast.success(messages.clients.toasts.saveSuccess);
    } else {
      toast.warning(
        messages.clients.toasts.savePartial(responseData.summary.successfulCount, responseData.summary.failedCount),
      );
    }

    responseData.failedInstances.forEach((failure) => {
      toast.error(
        `${messages.clients.toasts.instanceFailure(failure.instanceName, failure.message)} ${messages.clients.toasts.syncHint}`,
        {
          id: buildFailureToastId("clients-save", item.hwaddr, failure.instanceId),
          action: {
            label: messages.common.retry,
            onClick: () => {
              void submitClientChanges(item, {
                groupIds: sortedGroupIds,
                alias: normalizedAlias,
                comment: normalizedComment,
                retryInstanceId: failure.instanceId,
                keepDetailsDialogOpen: options.keepDetailsDialogOpen,
              });
            },
          },
        },
      );
    });

    closeGroupEditor();
    const nextData = await refreshClients(data.pagination.page, data.pagination.pageSize);

    if (!options.keepDetailsDialogOpen) {
      return;
    }

    if (!nextData) {
      return;
    }

    const refreshedClient = nextData.items.find((candidate) => candidate.hwaddr === item.hwaddr) ?? null;

    if (!refreshedClient) {
      closeDetailsDialog();
      return;
    }

    setDetailsDialogClient(refreshedClient);
    setDetailsAliasDraft(refreshedClient.alias ?? normalizedAlias ?? "");
    setDetailsCommentDraft(refreshedClient.comment ?? normalizedComment ?? "");
    setDetailsDraftGroupIds(sortNumberArray(refreshedClient.groupIds));
  };

  const runSync = async () => {
    setBusyAction("sync");

    const { data: responseData, response } = await client.POST<ClientsMutationResponse>("/clients/sync", {
      headers: {
        "x-yapd-csrf": csrfToken,
      },
      body: {},
    });

    setBusyAction(null);

    if (!response.ok || !responseData) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    if (responseData.failedInstances.length === 0) {
      toast.success(messages.clients.toasts.syncSuccess);
    } else {
      toast.warning(
        messages.clients.toasts.syncPartial(responseData.summary.successfulCount, responseData.summary.failedCount),
      );
      responseData.failedInstances.forEach((failure) => {
        toast.error(messages.clients.toasts.instanceFailure(failure.instanceName, failure.message), {
          id: buildFailureToastId("clients-sync", "baseline", failure.instanceId),
        });
      });
    }

    setIsSyncDialogOpen(false);
    await refreshClients(data.pagination.page, data.pagination.pageSize);
  };

  const formatQueries = (value: number) => new Intl.NumberFormat(locale).format(value);
  const formatDateTimeValue = (value: string | null) =>
    value ? formatFullDateTime(value) : messages.common.versionUnavailable;
  const formatInstanceDetailList = (details: ClientInstanceDetail[]) =>
    formatListValue(
      details.map((detail) => detail.instanceName),
      messages.common.versionUnavailable,
    );

  const renderSortIcon = (field: ClientsSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="size-3.5" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  const isDetailsDialogSaving = detailsDialogClient
    ? (busyAction?.startsWith(`save:${detailsDialogClient.hwaddr}`) ?? false)
    : false;
  const hasDetailsAliasChanges =
    detailsDialogClient !== null && detailsAliasDraft.trim() !== (detailsDialogClient.alias?.trim() ?? "");
  const hasDetailsCommentChanges =
    detailsDialogClient !== null && detailsCommentDraft.trim() !== (detailsDialogClient.comment?.trim() ?? "");
  const hasDetailsGroupChanges =
    detailsDialogClient !== null &&
    !areNumberArraysEqual(sortNumberArray(detailsDialogClient.groupIds), detailsDraftGroupIds);
  const selectedDetailsGroupNames = detailsDraftGroupIds
    .map((groupId) => groupNamesById.get(groupId) ?? `#${groupId}`)
    .join(", ");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{messages.clients.table.title}</CardTitle>
            <CardDescription>{messages.clients.table.description(data.source.baselineInstanceName)}</CardDescription>
          </div>
          <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <InputGroup className="min-w-56">
              <InputGroupInput
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={messages.clients.table.searchPlaceholder}
                disabled={busyAction !== null && busyAction !== "search"}
              />
              {searchDraft.length > 0 ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    aria-label={messages.clients.table.searchClear}
                    title={messages.clients.table.searchClear}
                    disabled={busyAction !== null && busyAction !== "search"}
                    onClick={() => setSearchDraft("")}
                  >
                    <X className="pointer-events-none size-3.5" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyAction !== null}
              onClick={() => void runRefresh()}
            >
              <RefreshCw className={cn(busyAction === "refresh" ? "animate-spin" : undefined)} />
              {busyAction === "refresh" ? messages.clients.table.refreshLoading : messages.clients.table.refresh}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyAction !== null}
              onClick={() => setIsSyncDialogOpen(true)}
            >
              <ArrowLeftRight className={cn(busyAction === "sync" ? "animate-pulse" : undefined)} />
              {busyAction === "sync" ? messages.clients.table.syncLoading : messages.clients.table.sync}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.source.unavailableInstanceCount > 0 ? (
            <Alert>
              <AlertTitle>{messages.clients.table.sync}</AlertTitle>
              <AlertDescription>
                {messages.clients.alerts.partialAvailability(
                  data.source.availableInstanceCount,
                  data.source.totalInstances,
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {data.items.length === 0 && !isReloading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MonitorSmartphone />
                </EmptyMedia>
                <EmptyTitle>{messages.clients.table.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.clients.table.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ClientsPagination
                changePageSize={(nextPageSize) => void changePageSize(nextPageSize)}
                goToPage={(page) => void goToPage(page)}
                isReloading={isReloading}
                messages={messages}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
              />

              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "client" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("client")}
                        >
                          {messages.clients.table.alias}
                          {renderSortIcon("client")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "instance" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("instance")}
                        >
                          {messages.clients.table.instance}
                          {renderSortIcon("instance")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={sortBy === "group" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("group")}
                        >
                          {messages.clients.table.group}
                          {renderSortIcon("group")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "firstSeen" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("firstSeen")}
                        >
                          {messages.clients.table.firstSeen}
                          {renderSortIcon("firstSeen")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "lastQuery" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("lastQuery")}
                        >
                          {messages.clients.table.lastQuery}
                          {renderSortIcon("lastQuery")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "numQueries" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("numQueries")}
                        >
                          {messages.clients.table.numQueries}
                          {renderSortIcon("numQueries")}
                        </Button>
                      </TableHead>
                      <TableHead
                        className="text-center"
                        aria-sort={
                          sortBy === "comment" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mx-auto h-auto px-2 py-1 font-medium"
                          disabled={busyAction !== null}
                          onClick={() => void toggleSort("comment")}
                        >
                          {messages.clients.table.comments}
                          {renderSortIcon("comment")}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">{messages.clients.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isReloading
                      ? TABLE_SKELETON_ROW_KEYS.map((rowKey) => (
                          <TableRow key={rowKey}>
                            <TableCell className="max-w-52">
                              <Skeleton className="mx-auto h-5 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="mx-auto h-5 w-28" />
                            </TableCell>
                            <TableCell className="min-w-72">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-9 w-28" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="mx-auto h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="mx-auto h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="mx-auto h-5 w-20" />
                            </TableCell>
                            <TableCell className="max-w-80">
                              <Skeleton className="mx-auto h-5 w-36" />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      : data.items.map((item) => {
                          const clientDisplayValue = getClientDisplayValue(item);
                          const groupLabels = resolveGroupLabels(item);
                          const sortedCurrentGroupIds = sortNumberArray(item.groupIds);
                          const isGroupEditorOpen = openGroupEditorHwaddr === item.hwaddr;
                          const isSavingThisRow = busyAction?.startsWith(`save:${item.hwaddr}`) ?? false;
                          const hasGroupChanges = !areNumberArraysEqual(sortedCurrentGroupIds, draftGroupIds);

                          return (
                            <TableRow key={item.hwaddr}>
                              <TableCell className="max-w-52 text-center">
                                <span className={cn(!clientDisplayValue && "text-muted-foreground")}>
                                  {clientDisplayValue ?? messages.common.versionUnavailable}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  {item.visibleInInstances.map((instance) => (
                                    <Badge
                                      key={`${item.hwaddr}-${instance.instanceId}`}
                                      variant={
                                        instance.instanceId === data.source.baselineInstanceId ? "default" : "outline"
                                      }
                                    >
                                      {instance.instanceName}
                                    </Badge>
                                  ))}
                                  {item.visibleInInstances.length > 1 ? (
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      aria-label={messages.clients.table.instanceDetailsAction(item.hwaddr)}
                                      title={messages.clients.table.instanceDetailsAction(item.hwaddr)}
                                      disabled={busyAction !== null}
                                      onClick={() => setInstancesDialogClient(item)}
                                    >
                                      <Info />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-72">
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  {groupLabels.length > 0 ? (
                                    groupLabels.map((groupName) => (
                                      <Badge key={`${item.hwaddr}-${groupName}`} variant="secondary">
                                        {groupName}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground">{messages.common.versionUnavailable}</span>
                                  )}
                                  <Popover
                                    open={isGroupEditorOpen}
                                    onOpenChange={(open) => {
                                      if (open) {
                                        openGroupEditor(item);
                                        return;
                                      }

                                      closeGroupEditor();
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" disabled={busyAction !== null}>
                                        <Tags />
                                        {messages.clients.table.group}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-80 space-y-4">
                                      <div className="space-y-1">
                                        <h3 className="font-medium">{messages.clients.table.groupEditorTitle}</h3>
                                        <p className="text-muted-foreground text-sm">
                                          {messages.clients.table.groupEditorDescription}
                                        </p>
                                      </div>
                                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                        {initialGroups.map((group) => {
                                          const checkboxId = `client-groups-${item.hwaddr}-${group.id}`;

                                          return (
                                            <div
                                              key={group.id}
                                              className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                                            >
                                              <Checkbox
                                                id={checkboxId}
                                                checked={draftGroupIds.includes(group.id)}
                                                disabled={busyAction !== null}
                                                onCheckedChange={(checked) =>
                                                  toggleDraftGroup(group.id, checked === true)
                                                }
                                              />
                                              <label htmlFor={checkboxId} className="flex-1">
                                                {group.name}
                                              </label>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex justify-end">
                                        <Button
                                          type="button"
                                          disabled={
                                            busyAction !== null || draftGroupIds.length === 0 || !hasGroupChanges
                                          }
                                          onClick={() =>
                                            void submitClientChanges(item, {
                                              groupIds: draftGroupIds,
                                            })
                                          }
                                        >
                                          <Tags className={cn(isSavingThisRow ? "animate-pulse" : undefined)} />
                                          {isSavingThisRow
                                            ? messages.clients.table.saveGroupsLoading
                                            : messages.clients.table.saveGroups}
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-xs tabular-nums">
                                {formatDateTimeValue(item.firstSeen)}
                              </TableCell>
                              <TableCell className="text-center text-xs tabular-nums">
                                {formatDateTimeValue(item.lastQuery)}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {formatQueries(item.numQueries)}
                              </TableCell>
                              <TableCell className="max-w-80 text-center">
                                <span className={cn(!item.comment && "text-muted-foreground")}>
                                  {item.comment && item.comment.length > 0
                                    ? item.comment
                                    : messages.common.versionUnavailable}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon-sm"
                                      variant="outline"
                                      disabled={busyAction !== null}
                                      aria-label={messages.clients.table.actions}
                                      title={messages.clients.table.actions}
                                    >
                                      <Ellipsis />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onSelect={() => openDetailsDialog(item)}>
                                      <Info />
                                      {messages.clients.table.viewMore}
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

              <ClientsPagination
                changePageSize={(nextPageSize) => void changePageSize(nextPageSize)}
                goToPage={(page) => void goToPage(page)}
                isReloading={isReloading}
                messages={messages}
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={instancesDialogClient !== null} onOpenChange={(open) => !open && setInstancesDialogClient(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {instancesDialogClient
                ? messages.clients.dialogs.instancesTitle(getClientDialogValue(instancesDialogClient))
                : messages.clients.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{messages.clients.dialogs.instancesDescription}</p>
            <div className="space-y-2">
              {instancesDialogClient?.visibleInInstances.map((instance) => (
                <div
                  key={instance.instanceId}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <span>{instance.instanceName}</span>
                  <Badge variant="outline">
                    {instance.instanceId === data.source.baselineInstanceId
                      ? messages.common.baseline
                      : messages.clients.table.instance}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInstancesDialogClient(null)}>
              {messages.clients.dialogs.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogClient !== null} onOpenChange={(open) => !open && closeDetailsDialog()}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {detailsDialogClient
                ? messages.clients.dialogs.detailsTitle(getClientDialogValue(detailsDialogClient))
                : messages.clients.title}
            </DialogTitle>
            <DialogDescription>{messages.clients.dialogs.detailsDescription}</DialogDescription>
          </DialogHeader>
          {detailsDialogClient ? (
            <>
              <Tabs
                value={detailsDialogTab}
                onValueChange={(value) => setDetailsDialogTab(value as DetailsDialogTab)}
                className="min-h-0 flex-1 gap-4"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">
                    <UserRound />
                    {messages.clients.dialogs.detailsOverviewTab}
                  </TabsTrigger>
                  <TabsTrigger value="groups">
                    <Tags />
                    {messages.clients.dialogs.detailsGroupsTab}
                  </TabsTrigger>
                  <TabsTrigger value="instances">
                    <Server />
                    {messages.clients.dialogs.detailsInstancesTab}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                        <UserRound className="size-3.5" />
                        <span>{messages.clients.dialogs.alias}</span>
                      </Label>
                      <Input
                        value={detailsAliasDraft}
                        onChange={(event) => setDetailsAliasDraft(event.target.value)}
                        disabled={busyAction !== null}
                        placeholder={messages.clients.dialogs.alias}
                      />
                    </div>
                    <ReadonlyField
                      label={messages.clients.dialogs.hwaddr}
                      value={detailsDialogClient.hwaddr}
                      icon={Fingerprint}
                    />
                    <ReadonlyField
                      label={messages.clients.dialogs.ips}
                      value={formatListValue(detailsDialogClient.ips, messages.common.versionUnavailable)}
                      className="md:col-span-2"
                      multiline
                      icon={Network}
                    />
                    <ReadonlyField
                      label={messages.clients.dialogs.macVendor}
                      value={detailsDialogClient.macVendor ?? messages.common.versionUnavailable}
                      icon={Building2}
                    />
                    <ReadonlyField
                      label={messages.clients.dialogs.visibleInstances}
                      value={formatInstanceDetailList(detailsDialogClient.instanceDetails)}
                      className="md:col-span-2"
                      multiline
                      icon={Server}
                    />
                    <ReadonlyField
                      label={messages.clients.table.firstSeen}
                      value={formatDateTimeValue(detailsDialogClient.firstSeen)}
                      icon={Clock3}
                    />
                    <ReadonlyField
                      label={messages.clients.table.lastQuery}
                      value={formatDateTimeValue(detailsDialogClient.lastQuery)}
                      icon={History}
                    />
                    <ReadonlyField
                      label={messages.clients.dialogs.totalQueries}
                      value={formatQueries(detailsDialogClient.numQueries)}
                      icon={Activity}
                    />
                    <div className="space-y-2 md:col-span-2">
                      <Label className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                        <MessageSquareText className="size-3.5" />
                        <span>{messages.clients.dialogs.comment}</span>
                      </Label>
                      <Textarea
                        value={detailsCommentDraft}
                        onChange={(event) => setDetailsCommentDraft(event.target.value)}
                        disabled={busyAction !== null}
                        className="min-h-24 resize-none"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="groups" className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-2 font-medium">
                        <Tags className="size-4" />
                        <span>{messages.clients.table.group}</span>
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {messages.clients.dialogs.groupSelectionDescription}
                      </p>
                    </div>
                    <ReadonlyField
                      label={messages.clients.dialogs.selectedGroups}
                      value={
                        selectedDetailsGroupNames.length > 0
                          ? selectedDetailsGroupNames
                          : messages.common.versionUnavailable
                      }
                      multiline
                      icon={Tags}
                    />
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {initialGroups.map((group) => {
                        const checkboxId = `client-details-groups-${detailsDialogClient.hwaddr}-${group.id}`;

                        return (
                          <div
                            key={group.id}
                            className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={detailsDraftGroupIds.includes(group.id)}
                              disabled={busyAction !== null}
                              onCheckedChange={(checked) => toggleDetailsDraftGroup(group.id, checked === true)}
                            />
                            <label htmlFor={checkboxId} className="flex-1">
                              {group.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="instances" className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-2 font-medium">
                        <Server className="size-4" />
                        <span>{messages.clients.dialogs.instanceBreakdownTitle}</span>
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {messages.clients.dialogs.instanceBreakdownDescription}
                      </p>
                    </div>
                    <div className="space-y-4">
                      {detailsDialogClient.instanceDetails.map((detail) => (
                        <div key={detail.instanceId} className="space-y-4 rounded-xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-medium">{detail.instanceName}</h4>
                            <Badge variant="outline">
                              {detail.instanceId === data.source.baselineInstanceId
                                ? messages.common.baseline
                                : messages.clients.table.instance}
                            </Badge>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <ReadonlyField
                              label={messages.clients.dialogs.ips}
                              value={formatListValue(detail.ips, messages.common.versionUnavailable)}
                              className="md:col-span-2"
                              multiline
                              icon={Network}
                            />
                            <ReadonlyField
                              label={messages.clients.table.firstSeen}
                              value={formatDateTimeValue(detail.firstSeen)}
                              icon={Clock3}
                            />
                            <ReadonlyField
                              label={messages.clients.table.lastQuery}
                              value={formatDateTimeValue(detail.lastQuery)}
                              icon={History}
                            />
                            <ReadonlyField
                              label={messages.clients.dialogs.instanceQueries}
                              value={formatQueries(detail.numQueries)}
                              icon={Activity}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isDetailsDialogSaving} onClick={closeDetailsDialog}>
                  {messages.clients.dialogs.close}
                </Button>
                <Button
                  type="button"
                  disabled={
                    busyAction !== null ||
                    (!hasDetailsAliasChanges &&
                      !hasDetailsCommentChanges &&
                      !(hasDetailsGroupChanges && detailsDraftGroupIds.length > 0))
                  }
                  onClick={() =>
                    void submitClientChanges(detailsDialogClient, {
                      groupIds: hasDetailsGroupChanges ? detailsDraftGroupIds : [],
                      alias: hasDetailsAliasChanges ? detailsAliasDraft : undefined,
                      comment: hasDetailsCommentChanges ? detailsCommentDraft : undefined,
                      keepDetailsDialogOpen: true,
                    })
                  }
                >
                  <Tags className={cn(isDetailsDialogSaving ? "animate-pulse" : undefined)} />
                  {isDetailsDialogSaving
                    ? messages.clients.dialogs.detailsSaveLoading
                    : messages.clients.dialogs.detailsSave}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.clients.dialogs.syncTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.clients.dialogs.syncDescription(data.source.baselineInstanceName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p>{messages.clients.dialogs.syncWarning}</p>
            <p className="text-muted-foreground">{messages.clients.dialogs.syncExtraEntries}</p>
            {data.source.unavailableInstanceCount > 0 ? (
              <Alert>
                <AlertTitle>{messages.clients.table.sync}</AlertTitle>
                <AlertDescription>
                  {messages.clients.alerts.partialAvailability(
                    data.source.availableInstanceCount,
                    data.source.totalInstances,
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction === "sync"}>
              {messages.clients.dialogs.syncCancel}
            </AlertDialogCancel>
            <AlertDialogAction disabled={busyAction === "sync"} onClick={() => void runSync()}>
              {busyAction === "sync"
                ? messages.clients.dialogs.syncConfirmLoading
                : messages.clients.dialogs.syncConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
