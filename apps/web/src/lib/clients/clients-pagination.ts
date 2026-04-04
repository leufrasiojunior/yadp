export const DEFAULT_CLIENTS_PAGE_SIZE = 10;
export const CLIENT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function normalizeClientsPageSize(value: number) {
  return CLIENT_PAGE_SIZE_OPTIONS.includes(value as (typeof CLIENT_PAGE_SIZE_OPTIONS)[number])
    ? value
    : DEFAULT_CLIENTS_PAGE_SIZE;
}
