"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WebMessages } from "@/lib/i18n/messages";
import {
  DEFAULT_QUERIES_LENGTH,
  normalizeQueryPageSize,
  QUERY_PAGE_SIZE_OPTIONS,
  type QueryFilters,
} from "@/lib/queries/queries-filters";

type QueriesPaginationProps = {
  activeFilters: QueryFilters;
  changePageSize: (nextLength: number) => void;
  goToPage: (start: number) => void;
  isLiveEnabled: boolean;
  isReloading: boolean;
  messages: WebMessages;
  totalRecords: number;
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

export function QueriesPagination({
  activeFilters,
  changePageSize,
  goToPage,
  isLiveEnabled,
  isReloading,
  messages,
  totalRecords,
}: Readonly<QueriesPaginationProps>) {
  const visibleStart = totalRecords > 0 ? activeFilters.start + 1 : 0;
  const visibleEnd = activeFilters.start + (totalRecords > activeFilters.length ? activeFilters.length : totalRecords);
  const canGoPrevious = activeFilters.start > 0;
  const canGoNext = activeFilters.start + activeFilters.length < totalRecords;
  const currentPage = Math.floor(activeFilters.start / activeFilters.length) + 1;
  const totalPages = Math.max(1, Math.ceil(totalRecords / activeFilters.length));
  const visiblePages = buildVisiblePages(totalPages, currentPage);

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{messages.queries.table.showing(visibleStart, visibleEnd, totalRecords)}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isLiveEnabled ? (
          <span className="text-muted-foreground text-xs">{messages.queries.table.liveNavigationWarning}</span>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{messages.queries.table.rowsPerPage}</span>
          <Select
            value={`${normalizeQueryPageSize(activeFilters.length)}`}
            onValueChange={(value) => changePageSize(Number(value) || DEFAULT_QUERIES_LENGTH)}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUERY_PAGE_SIZE_OPTIONS.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={isLiveEnabled || !canGoPrevious || isReloading}
          onClick={() => goToPage(activeFilters.start - activeFilters.length)}
        >
          {messages.queries.table.previous}
        </Button>
        {visiblePages.map((page, index) => {
          const previousPage = visiblePages[index - 1];
          const shouldShowGap = previousPage !== undefined && page - previousPage > 1;

          return (
            <div key={`page-slot-${page}`} className="flex items-center gap-2">
              {shouldShowGap ? <span className="px-1 text-muted-foreground">...</span> : null}
              <Button
                variant={page === currentPage ? "default" : "outline"}
                disabled={isLiveEnabled || isReloading || page === currentPage}
                aria-current={page === currentPage ? "page" : undefined}
                onClick={() => goToPage((page - 1) * activeFilters.length)}
              >
                {page}
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          disabled={isLiveEnabled || !canGoNext || isReloading}
          onClick={() => goToPage(activeFilters.start + activeFilters.length)}
        >
          {messages.queries.table.next}
        </Button>
      </div>
    </div>
  );
}
