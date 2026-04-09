import type { PiholeRequestErrorKind } from "../pihole/pihole.service";

export const DOMAIN_OPERATION_TYPES = ["allow", "deny"] as const;
export const DOMAIN_OPERATION_KINDS = ["exact", "regex"] as const;
export const DOMAIN_SCOPE_VALUES = ["all", "instance"] as const;

export type DomainOperationType = (typeof DOMAIN_OPERATION_TYPES)[number];
export type DomainOperationKind = (typeof DOMAIN_OPERATION_KINDS)[number];
export type DomainScopeMode = (typeof DOMAIN_SCOPE_VALUES)[number];

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
