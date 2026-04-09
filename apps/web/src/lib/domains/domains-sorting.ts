import type { DomainFilterValue, DomainsSortDirection, DomainsSortField } from "@/lib/api/yapd-types";

export const DEFAULT_DOMAINS_SORT_FIELD: DomainsSortField = "domain";
export const DEFAULT_DOMAINS_SORT_DIRECTION: DomainsSortDirection = "asc";
export const ALL_DOMAIN_FILTERS: DomainFilterValue[] = ["exact-allow", "regex-allow", "exact-deny", "regex-deny"];

const DEFAULT_SORT_DIRECTIONS_BY_FIELD: Record<DomainsSortField, DomainsSortDirection> = {
  domain: "asc",
  type: "asc",
  kind: "asc",
  enabled: "desc",
  comment: "asc",
  group: "asc",
};

export function getDefaultDomainsSortDirection(field: DomainsSortField): DomainsSortDirection {
  return DEFAULT_SORT_DIRECTIONS_BY_FIELD[field];
}
