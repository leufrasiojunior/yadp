"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIENT_PAGE_SIZE_OPTIONS,
  DEFAULT_CLIENTS_PAGE_SIZE,
  normalizeClientsPageSize,
} from "@/lib/clients/clients-pagination";
import type { WebMessages } from "@/lib/i18n/messages";

type ClientsPaginationProps = {
  changePageSize: (nextPageSize: number) => void;
  goToPage: (page: number) => void;
  isReloading: boolean;
  messages: WebMessages;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function buildVisiblePages(totalPages: number, currentPage: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_value, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) {
      pages.add(page);
    }
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 3);
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  }

  return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right);
}

export function ClientsPagination({
  changePageSize,
  goToPage,
  isReloading,
  messages,
  page,
  pageSize,
  totalItems,
  totalPages,
}: Readonly<ClientsPaginationProps>) {
  const visibleStart = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = totalItems > 0 ? Math.min(page * pageSize, totalItems) : 0;
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const visiblePages = buildVisiblePages(totalPages, page);
  const normalizedPageSize = `${normalizeClientsPageSize(Number(pageSize))}`;

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{messages.clients.table.showing(visibleStart, visibleEnd, totalItems)}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{messages.clients.table.rowsPerPage}</span>
          <Select
            key={`clients-page-size-${normalizedPageSize}`}
            value={normalizedPageSize}
            onValueChange={(value) => changePageSize(Number(value) || DEFAULT_CLIENTS_PAGE_SIZE)}
          >
            <SelectTrigger className="w-24">
              <SelectValue>{normalizedPageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CLIENT_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={`${option}`}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={!canGoPrevious || isReloading} onClick={() => goToPage(page - 1)}>
          {messages.clients.table.previous}
        </Button>
        {visiblePages.map((visiblePage, index) => {
          const previousPage = visiblePages[index - 1];
          const shouldShowGap = previousPage !== undefined && visiblePage - previousPage > 1;

          return (
            <div key={`clients-page-${visiblePage}`} className="flex items-center gap-2">
              {shouldShowGap ? <span className="px-1 text-muted-foreground">...</span> : null}
              <Button
                variant={visiblePage === page ? "default" : "outline"}
                disabled={isReloading || visiblePage === page}
                aria-current={visiblePage === page ? "page" : undefined}
                onClick={() => goToPage(visiblePage)}
              >
                {visiblePage}
              </Button>
            </div>
          );
        })}
        <Button variant="outline" disabled={!canGoNext || isReloading} onClick={() => goToPage(page + 1)}>
          {messages.clients.table.next}
        </Button>
      </div>
    </div>
  );
}
