import type { PiholeRequestErrorKind } from "../pihole/pihole.types";
import { PIHOLE_DOMAIN_OPERATION_KINDS, PIHOLE_DOMAIN_OPERATION_TYPES } from "../pihole/pihole.types";

export const DOMAIN_OPERATION_TYPES = [...PIHOLE_DOMAIN_OPERATION_TYPES] as const;
export const DOMAIN_OPERATION_KINDS = [...PIHOLE_DOMAIN_OPERATION_KINDS] as const;
export const DOMAIN_SCOPE_VALUES = ["all", "instance"] as const;
export const DEFAULT_DOMAIN_OPERATION_COMMENT = "Added from Query Log";

export type DomainOperationType = (typeof DOMAIN_OPERATION_TYPES)[number];
export type DomainOperationKind = (typeof DOMAIN_OPERATION_KINDS)[number];
export type DomainScopeMode = (typeof DOMAIN_SCOPE_VALUES)[number];

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
        errors: Array<{
          item: string | null;
          message: string | null;
        }>;
        success: Array<{
          item: string | null;
        }>;
      };
      took: number | null;
    }
  >;
  failedInstances: DomainsInstanceFailure[];
};
