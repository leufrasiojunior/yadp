import type { ListsSortDirection, ListsSortField } from "@/lib/api/yapd-types";

export const DEFAULT_LISTS_SORT_FIELD: ListsSortField = "address";
export const DEFAULT_LISTS_SORT_DIRECTION: ListsSortDirection = "asc";

const DEFAULT_SORT_DIRECTIONS_BY_FIELD: Record<ListsSortField, ListsSortDirection> = {
  address: "asc",
  type: "asc",
  enabled: "desc",
  comment: "asc",
  group: "asc",
};

export function getDefaultListsSortDirection(field: ListsSortField): ListsSortDirection {
  return DEFAULT_SORT_DIRECTIONS_BY_FIELD[field];
}
