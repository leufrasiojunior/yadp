export type SubnetState = { groups: string[]; comment: string };
export type SubnetInstance = { instanceId: string; instanceName: string };
export type SubnetFailure = SubnetInstance & { message: string };
export type SubnetRule = { client: string; instances: (SubnetInstance & SubnetState)[] };
export type SubnetListResponse = {
  items: SubnetRule[];
  instances: SubnetInstance[];
  unavailableInstances: SubnetFailure[];
};
export type SubnetRequest = {
  client: string;
  operation: "save" | "delete";
  groups?: string[];
  comment?: string;
  targetInstanceIds: string[];
};
export type SubnetPlan = {
  client: string;
  operation: "save" | "delete";
  targets: (SubnetInstance & {
    action: "create" | "update" | "delete" | "unchanged" | "unavailable";
    current: SubnetState | null;
    desired: SubnetState | null;
    message?: string;
  })[];
  previewToken: string;
};
export type SubnetApplyResponse = {
  status: "success" | "partial";
  successfulInstances: SubnetInstance[];
  failedInstances: SubnetFailure[];
};
