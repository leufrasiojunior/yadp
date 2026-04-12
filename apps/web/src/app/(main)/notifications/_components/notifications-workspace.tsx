"use client";

import { useMemo, useState } from "react";

import {
  Archive,
  BellDot,
  CheckCheck,
  Clock3,
  Inbox,
  MessageSquareText,
  MoreHorizontal,
  Server,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ManagedItemsPagination } from "@/app/(main)/_components/managed-items-pagination";
import { ManagedItemsTableSkeleton } from "@/app/(main)/_components/managed-items-table-skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  NotificationMutationResponse,
  NotificationReadState,
  NotificationsListResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import {
  getNotificationInstanceLabel,
  getNotificationTypeIcon,
  getNotificationTypeLabel,
} from "@/lib/notifications/notifications";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/stores/notifications/notifications-provider";

type NotificationsWorkspaceProps = {
  initialData: NotificationsListResponse;
};

export function NotificationsWorkspace({ initialData }: Readonly<NotificationsWorkspaceProps>) {
  const { csrfToken } = useAppSession();
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const { formatDateTime, messages } = useWebI18n();
  const refreshPreview = useNotificationsStore((state) => state.refreshPreview);
  const [data, setData] = useState(initialData);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isReloading = busyAction === "page" || busyAction === "page-size" || busyAction === "tab";

  const refreshPage = async (
    page = data.pagination.page,
    pageSize = data.pagination.pageSize,
    readState: NotificationReadState = data.readState,
  ) => {
    const { data: nextData, response } = await client.GET<NotificationsListResponse>("/notifications", {
      params: {
        query: {
          page,
          pageSize,
          readState,
        },
      },
    });

    if (!response.ok || !nextData) {
      toast.error(messages.notifications.toasts.refreshFailed);
      return null;
    }

    setData(nextData);
    return nextData;
  };

  const handleMarkRead = async (id: string) => {
    setBusyAction(`read:${id}`);

    try {
      const { data: responseData, response } = await client.PATCH<NotificationMutationResponse>(
        `/notifications/${id}/read`,
        {
          headers: {
            "x-yapd-csrf": csrfToken,
          },
        },
      );

      if (!response.ok || !responseData) {
        toast.error(messages.notifications.toasts.refreshFailed);
        return;
      }

      if (data.readState === "unread") {
        const targetPage =
          data.items.length === 1 && data.pagination.page > 1 ? data.pagination.page - 1 : data.pagination.page;

        setData((current) => {
          const nextTotalItems = Math.max(0, current.pagination.totalItems - 1);
          const nextTotalPages = Math.max(1, Math.ceil(nextTotalItems / current.pagination.pageSize));

          return {
            ...current,
            items: current.items.filter((item) => item.id !== id),
            unreadCount: Math.max(0, current.unreadCount - 1),
            pagination: {
              ...current.pagination,
              page: Math.min(targetPage, nextTotalPages),
              totalItems: nextTotalItems,
              totalPages: nextTotalPages,
            },
          };
        });

        await refreshPage(targetPage, data.pagination.pageSize, "unread");
      } else {
        setData((current) => ({
          ...current,
          items: current.items.map((item) => (item.id === id ? responseData.notification : item)),
          unreadCount: Math.max(0, current.unreadCount - 1),
        }));
      }

      toast.success(messages.notifications.toasts.markReadSuccess);
      await refreshPreview();
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyAction(`delete:${id}`);

    try {
      const { data: responseData, response } = await client.DELETE<NotificationMutationResponse>(
        `/notifications/${id}`,
        {
          headers: {
            "x-yapd-csrf": csrfToken,
          },
        },
      );

      if (!response.ok || !responseData) {
        toast.error(messages.notifications.toasts.refreshFailed);
        return;
      }

      const nextPageData = await refreshPage(
        data.items.length === 1 && data.pagination.page > 1 ? data.pagination.page - 1 : data.pagination.page,
        data.pagination.pageSize,
        data.readState,
      );

      if (nextPageData) {
        toast.success(messages.notifications.toasts.deleteSuccess);
        await refreshPreview();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const goToPage = async (page: number) => {
    setBusyAction("page");

    try {
      await refreshPage(page, data.pagination.pageSize, data.readState);
    } finally {
      setBusyAction(null);
    }
  };

  const changePageSize = async (pageSize: number) => {
    setBusyAction("page-size");

    try {
      await refreshPage(1, pageSize, data.readState);
    } finally {
      setBusyAction(null);
    }
  };

  const handleTabChange = async (nextReadState: string) => {
    if (nextReadState !== "unread" && nextReadState !== "read") {
      return;
    }

    if (nextReadState === data.readState) {
      return;
    }

    setBusyAction("tab");

    try {
      await refreshPage(1, data.pagination.pageSize, nextReadState);
    } finally {
      setBusyAction(null);
    }
  };

  const isReadTab = data.readState === "read";
  const countLabel = isReadTab
    ? messages.notifications.table.readBadge(data.pagination.totalItems)
    : messages.notifications.table.unreadBadge(data.pagination.totalItems);
  const EmptyStateIcon = isReadTab ? Archive : Inbox;

  return (
    <Tabs value={data.readState} onValueChange={(value) => void handleTabChange(value)} className="gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          {isReadTab ? <Archive className="size-4" /> : <BellDot className="size-4" />}
          <span>{countLabel}</span>
        </p>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="unread" disabled={busyAction !== null}>
            <BellDot className="size-4" />
            {messages.notifications.table.tabs.unread}
          </TabsTrigger>
          <TabsTrigger value="read" disabled={busyAction !== null}>
            <Archive className="size-4" />
            {messages.notifications.table.tabs.read}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>
                <span className="inline-flex items-center gap-2">
                  <BellDot className="size-4 text-muted-foreground" />
                  <span>{messages.notifications.table.type}</span>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-2">
                  <Server className="size-4 text-muted-foreground" />
                  <span>{messages.notifications.table.instance}</span>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-2">
                  <MessageSquareText className="size-4 text-muted-foreground" />
                  <span>{messages.notifications.table.message}</span>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <span>{messages.notifications.table.time}</span>
                </span>
              </TableHead>
              <TableHead className="w-28 text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                  <span>{messages.notifications.table.actions}</span>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReloading ? (
              <ManagedItemsTableSkeleton columnCount={5} />
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <EmptyStateIcon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">
                        {isReadTab
                          ? messages.notifications.table.emptyReadTitle
                          : messages.notifications.table.emptyUnreadTitle}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {isReadTab
                          ? messages.notifications.table.emptyReadDescription
                          : messages.notifications.table.emptyUnreadDescription}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((item) => {
                const TypeIcon = getNotificationTypeIcon(item.type);
                const InstanceIcon = item.instanceName?.trim().length ? Server : BellDot;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "odd:bg-background even:bg-muted/25",
                      !item.isRead && "bg-primary/5 even:bg-primary/5",
                    )}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <TypeIcon className="size-4" />
                        </span>
                        {!item.isRead ? <span className="size-2 rounded-full bg-primary" aria-hidden /> : null}
                        <span>{getNotificationTypeLabel(item.type, messages)}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <InstanceIcon className="size-4 text-muted-foreground" />
                        <span>{getNotificationInstanceLabel(item, messages)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-normal break-words">{item.message}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="size-4" />
                        <span>{formatDateTime(item.occurredAt)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busyAction !== null}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isReadTab ? (
                            <DropdownMenuItem onSelect={() => void handleMarkRead(item.id)} disabled={item.isRead}>
                              <CheckCheck className="size-4" />
                              {busyAction === `read:${item.id}`
                                ? messages.notifications.actions.markingRead
                                : messages.notifications.actions.markRead}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onSelect={() => void handleDelete(item.id)}>
                            <Trash2 className="size-4" />
                            {busyAction === `delete:${item.id}`
                              ? messages.notifications.actions.deleting
                              : messages.notifications.actions.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <ManagedItemsPagination
        changePageSize={changePageSize}
        goToPage={goToPage}
        isReloading={isReloading}
        nextLabel={messages.notifications.table.next}
        page={data.pagination.page}
        pageSize={data.pagination.pageSize}
        previousLabel={messages.notifications.table.previous}
        rowsPerPageLabel={messages.notifications.table.rowsPerPage}
        showingLabel={messages.notifications.table.showing}
        totalItems={data.pagination.totalItems}
        totalPages={data.pagination.totalPages}
      />
    </Tabs>
  );
}
