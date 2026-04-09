export const DEFAULT_MANAGED_ITEMS_PAGE_SIZE = 10;
export const MANAGED_ITEMS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function normalizeManagedItemsPageSize(value: number) {
  return MANAGED_ITEMS_PAGE_SIZE_OPTIONS.includes(value as (typeof MANAGED_ITEMS_PAGE_SIZE_OPTIONS)[number])
    ? value
    : DEFAULT_MANAGED_ITEMS_PAGE_SIZE;
}
