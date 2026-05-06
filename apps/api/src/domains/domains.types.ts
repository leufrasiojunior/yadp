import type { PiholeRequestErrorKind } from "../pihole/pihole.types";

export const DOMAIN_OPERATION_TYPES = ["allow", "deny"] as const;
export const DOMAIN_OPERATION_KINDS = ["exact", "regex"] as const;
export const DOMAIN_SCOPE_VALUES = ["all", "instance"] as const;
export const DOMAIN_FILTER_VALUES = ["exact-allow", "regex-allow", "exact-deny", "regex-deny"] as const;
export const DOMAIN_PATTERN_MODE_VALUES = ["exact", "regex_specific", "regex_any"] as const;
export const DEFAULT_DOMAINS_PAGE_SIZE = 10;
export const MAX_DOMAINS_PAGE_SIZE = 100;
export const MAX_DOMAINS_PAGE = 999;
export const DOMAIN_SORT_FIELDS = ["domain", "type", "kind", "enabled", "comment", "group"] as const;
export const DOMAIN_SORT_DIRECTIONS = ["asc", "desc"] as const;
export const DEFAULT_DOMAINS_SORT_FIELD = "domain";
export const DEFAULT_DOMAINS_SORT_DIRECTION = "asc";

export type DomainOperationType = (typeof DOMAIN_OPERATION_TYPES)[number];
export type DomainOperationKind = (typeof DOMAIN_OPERATION_KINDS)[number];
export type DomainScopeMode = (typeof DOMAIN_SCOPE_VALUES)[number];
export type DomainFilterValue = (typeof DOMAIN_FILTER_VALUES)[number];
export type DomainPatternMode = (typeof DOMAIN_PATTERN_MODE_VALUES)[number];
export type DomainSortField = (typeof DOMAIN_SORT_FIELDS)[number];
export type DomainSortDirection = (typeof DOMAIN_SORT_DIRECTIONS)[number];

export const DEFAULT_DOMAIN_OPERATION_COMMENT = "Added from YAPD";

export type DomainItem = {
  domain: string;
  unicode: string | null;
  type: string;
  kind: string;
  comment: string | null;
  enabled: boolean;
  groups: number[];
  id: number;
  dateAdded: number | null;
  dateModified: number | null;
  origin: {
    instanceId: string;
    instanceName: string;
  };
  sync: {
    isFullySynced: boolean;
    sourceInstances: DomainsInstanceSource[];
    missingInstances: DomainsInstanceSource[];
  };
};

export type DomainsListResponse = {
  items: DomainItem[];
  summary: {
    totalItems: number;
    allowTotal: number;
    denyTotal: number;
    allowExact: number;
    allowRegex: number;
    denyExact: number;
    denyRegex: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  source: {
    baselineInstanceId: string;
    baselineInstanceName: string;
    totalInstances: number;
    availableInstanceCount: number;
    unavailableInstanceCount: number;
  };
  unavailableInstances: DomainsInstanceFailure[];
};

export type DomainsInstanceSource = {
  instanceId: string;
  instanceName: string;
};

export type DomainsInstanceFailure = DomainsInstanceSource & {
  kind: PiholeRequestErrorKind;
  message: string;
};

export type DomainOperationResponse = {
  request: {
    type: DomainOperationType;
    kind: DomainOperationKind;
    domain: string;
    value: string;
    comment: string;
    patternMode: DomainPatternMode | null;
    scope: DomainScopeMode;
    instanceId: string | null;
  };
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: Array<
    DomainsInstanceSource & {
      processed: {
        errors: Array<{ item: string | null; message: string | null }>;
        success: Array<{ item: string | null }>;
      };
      took: number | null;
    }
  >;
  failedInstances: DomainsInstanceFailure[];
};

export type DomainsMutationResponse = {
  status: "success" | "partial";
  summary: {
    totalInstances: number;
    successfulCount: number;
    failedCount: number;
  };
  successfulInstances: DomainsInstanceSource[];
  failedInstances: DomainsInstanceFailure[];
};

export type DomainsImportError = {
  line: number;
  message: string;
};

export type DomainsImportResponse = {
  status: "success" | "partial";
  summary: {
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    invalidCount: number;
  };
  errors: DomainsImportError[];
};
