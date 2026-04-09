"use client";

import { useId } from "react";

import { Database, RadioIcon } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DomainOperationResponse, QueriesResponse } from "@/lib/api/yapd-types";
import { formatFullDateTime } from "@/lib/i18n/config";
import type { WebMessages } from "@/lib/i18n/messages";
import type { QueryFilters } from "@/lib/queries/queries-filters";
import { cn } from "@/lib/utils";

import { QueriesPagination } from "./queries-pagination";
import { QueriesTableSkeleton } from "./queries-table-skeleton";
import { QueryActionCell } from "./query-action-cell";
import { QueryStatusCell } from "./query-status-cell";

type DomainActionType = DomainOperationResponse["request"]["type"];
type DomainActionKind = DomainOperationResponse["request"]["kind"];

type QueriesTableCardProps = {
  activeFilters: QueryFilters;
  changePageSize: (nextLength: number) => void;
  goToPage: (start: number) => void;
  isAnyDomainActionPending: (query: QueriesResponse["queries"][number]) => boolean;
  isDomainActionPending: (
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) => boolean;
  isLiveEnabled: boolean;
  isRefreshing: boolean;
  isReloading: boolean;
  messages: WebMessages;
  newRowKeys: string[];
  queryData: QueriesResponse;
  setIsLiveEnabled: (enabled: boolean) => void;
  setTableClientFilter: (filter: string) => void;
  setTableDomainFilter: (filter: string) => void;
  submitDomainAction: (
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) => Promise<void>;
  tableClientFilter: string;
  tableDomainFilter: string;
  timeZone: string;
};

function buildRowKey(query: QueriesResponse["queries"][number]) {
  return `${query.instanceId}:${query.id}`;
}

function getClientLabel(query: QueriesResponse["queries"][number], fallback: string) {
  const ip = query.client?.ip?.trim() ?? "";
  const alias = query.client?.alias?.trim() ?? "";

  if (ip.length > 0 && alias.length > 0) {
    return `${ip} (${alias})`;
  }

  if (alias.length > 0) {
    return alias;
  }

  return query.client?.name ?? query.client?.ip ?? fallback;
}

function normalizeStatus(status: string | null) {
  return status?.trim().toUpperCase() ?? "";
}

function getRowTintClass(status: string | null, index: number) {
  const even = index % 2 === 0;

  switch (normalizeStatus(status)) {
    case "CACHE":
      return even ? "bg-emerald-500/5 hover:bg-emerald-500/9" : "bg-emerald-500/7 hover:bg-emerald-500/11";
    case "FORWARDED":
      return even ? "bg-emerald-500/8 hover:bg-emerald-500/12" : "bg-emerald-500/10 hover:bg-emerald-500/14";
    case "CACHE_STALE":
      return even ? "bg-emerald-500/12 hover:bg-emerald-500/16" : "bg-emerald-500/14 hover:bg-emerald-500/18";
    case "GRAVITY":
      return even ? "bg-red-500/7 hover:bg-red-500/11" : "bg-red-500/9 hover:bg-red-500/13";
    case "DENYLIST":
      return even ? "bg-red-500/7 hover:bg-red-500/11" : "bg-red-500/9 hover:bg-red-500/13";
    default:
      return "";
  }
}

export function QueriesTableCard({
  activeFilters,
  changePageSize,
  goToPage,
  isAnyDomainActionPending,
  isDomainActionPending,
  isLiveEnabled,
  isRefreshing,
  isReloading,
  messages,
  newRowKeys,
  queryData,
  setIsLiveEnabled,
  setTableClientFilter,
  setTableDomainFilter,
  submitDomainAction,
  tableClientFilter,
  tableDomainFilter,
  timeZone,
}: Readonly<QueriesTableCardProps>) {
  const liveToggleId = useId();
  const hasRows = queryData.queries.length > 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{messages.queries.table.title}</CardTitle>
          <CardDescription className="mt-1">{messages.queries.table.description}</CardDescription>
        </div>
        <CardAction>
          <label htmlFor={liveToggleId} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox
              id={liveToggleId}
              checked={isLiveEnabled}
              disabled={activeFilters.disk}
              onCheckedChange={(checked) => setIsLiveEnabled(checked === true)}
            />
            <span className="font-medium">{messages.queries.table.liveToggle}</span>
            <RadioIcon color="#ffffff" />
            {isRefreshing ? <Spinner /> : null}
          </label>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {isReloading ? (
          <QueriesTableSkeleton />
        ) : hasRows ? (
          <>
            <QueriesPagination
              activeFilters={activeFilters}
              changePageSize={changePageSize}
              goToPage={goToPage}
              isLiveEnabled={isLiveEnabled}
              isReloading={isReloading}
              messages={messages}
              totalRecords={queryData.recordsFiltered}
            />

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r text-center">{messages.queries.table.time}</TableHead>
                    <TableHead className="border-r text-center">{messages.queries.table.instance}</TableHead>
                    <TableHead className="w-14 border-r text-center">
                      <span className="sr-only">{messages.queries.table.status}</span>
                    </TableHead>
                    <TableHead className="border-r text-center">{messages.queries.table.type}</TableHead>
                    <TableHead className="border-r text-center">{messages.queries.table.domain}</TableHead>
                    <TableHead className="border-r text-center">{messages.queries.table.client}</TableHead>
                    <TableHead className="w-34 text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryData.queries.map((query, index) => (
                    <TableRow
                      key={buildRowKey(query)}
                      className={cn(
                        getRowTintClass(query.status, index),
                        newRowKeys.includes(buildRowKey(query)) &&
                          "fade-in-0 slide-in-from-top-2 animate-in duration-300",
                      )}
                    >
                      <TableCell className="border-r text-center text-xs tabular-nums">
                        {formatFullDateTime(query.time, timeZone)}
                      </TableCell>
                      <TableCell className="max-w-56 truncate border-r text-center font-medium">
                        {query.instanceName}
                      </TableCell>
                      <TableCell className="border-r text-center">
                        <QueryStatusCell messages={messages} status={query.status} />
                      </TableCell>
                      <TableCell className="border-r text-center">
                        {query.type ?? messages.common.versionUnavailable}
                      </TableCell>
                      <TableCell className="max-w-96 truncate border-r text-center">
                        {query.domain ?? messages.common.versionUnavailable}
                      </TableCell>
                      <TableCell className="max-w-72 truncate border-r text-center">
                        {getClientLabel(query, messages.common.versionUnavailable)}
                      </TableCell>
                      <TableCell className="text-center">
                        <QueryActionCell
                          isAnyDomainActionPending={isAnyDomainActionPending}
                          isDomainActionPending={isDomainActionPending}
                          messages={messages}
                          query={query}
                          submitDomainAction={submitDomainAction}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-background font-normal">
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="border-r" />
                    <TableCell className="border-r" />
                    <TableCell className="border-r" />
                    <TableCell className="border-r" />
                    <TableCell className="border-r p-1.5">
                      <Input
                        value={tableDomainFilter}
                        placeholder={messages.queries.table.domain}
                        className="text-center"
                        onChange={(event) => setTableDomainFilter(event.target.value)}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        value={tableClientFilter}
                        placeholder={messages.queries.table.client}
                        className="text-center"
                        onChange={(event) => setTableClientFilter(event.target.value)}
                      />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <QueriesPagination
              activeFilters={activeFilters}
              changePageSize={changePageSize}
              goToPage={goToPage}
              isLiveEnabled={isLiveEnabled}
              isReloading={isReloading}
              messages={messages}
              totalRecords={queryData.recordsFiltered}
            />
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Database />
              </EmptyMedia>
              <EmptyTitle>{messages.queries.table.noResultsTitle}</EmptyTitle>
              <EmptyDescription>{messages.queries.table.noResultsDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
