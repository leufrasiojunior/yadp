"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_MANAGED_ITEMS_PAGE_SIZE,
  MANAGED_ITEMS_PAGE_SIZE_OPTIONS,
  normalizeManagedItemsPageSize,
} from "@/lib/managed-items/pagination";

type ManagedItemsPaginationProps = {
  changePageSize: (nextPageSize: number) => void;
  goToPage: (page: number) => void;
  isReloading: boolean;
  nextLabel: string;
  page: number;
  pageSize: number;
  previousLabel: string;
  rowsPerPageLabel: string;
  showingLabel: (start: number, end: number, total: number) => string;
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

export function ManagedItemsPagination({
  changePageSize,
  goToPage,
  isReloading,
  nextLabel,
  page,
  pageSize,
  previousLabel,
  rowsPerPageLabel,
  showingLabel,
  totalItems,
  totalPages,
}: Readonly<ManagedItemsPaginationProps>) {
  const visibleStart = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = totalItems > 0 ? Math.min(page * pageSize, totalItems) : 0;
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const visiblePages = buildVisiblePages(totalPages, page);
  const normalizedPageSize = `${normalizeManagedItemsPageSize(Number(pageSize))}`;

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{showingLabel(visibleStart, visibleEnd, totalItems)}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{rowsPerPageLabel}</span>
          <Select
            key={`managed-page-size-${normalizedPageSize}`}
            value={normalizedPageSize}
            onValueChange={(value) => changePageSize(Number(value) || DEFAULT_MANAGED_ITEMS_PAGE_SIZE)}
          >
            <SelectTrigger className="w-24">
              <SelectValue>{normalizedPageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MANAGED_ITEMS_PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                <SelectItem key={pageSizeOption} value={`${pageSizeOption}`}>
                  {pageSizeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={!canGoPrevious || isReloading} onClick={() => goToPage(page - 1)}>
          {previousLabel}
        </Button>
        {visiblePages.map((visiblePage, index) => {
          const previousPage = visiblePages[index - 1];
          const shouldShowGap = previousPage !== undefined && visiblePage - previousPage > 1;

          return (
            <div key={`managed-page-${visiblePage}`} className="flex items-center gap-2">
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
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
