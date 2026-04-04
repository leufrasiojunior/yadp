import type { ClientsSortDirection, ClientsSortField } from "@/lib/api/yapd-types";

export const DEFAULT_CLIENTS_SORT_FIELD: ClientsSortField = "lastQuery";
export const DEFAULT_CLIENTS_SORT_DIRECTION: ClientsSortDirection = "desc";

const DEFAULT_SORT_DIRECTIONS_BY_FIELD: Record<ClientsSortField, ClientsSortDirection> = {
  client: "asc",
  instance: "asc",
  group: "asc",
  firstSeen: "desc",
  lastQuery: "desc",
  numQueries: "desc",
  comment: "asc",
};

export function getDefaultClientsSortDirection(field: ClientsSortField): ClientsSortDirection {
  return DEFAULT_SORT_DIRECTIONS_BY_FIELD[field];
}
