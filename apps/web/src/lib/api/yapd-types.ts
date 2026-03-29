import type { AppSession } from "@/components/yapd/app-session-provider";

export type SetupCredentialMode = "shared" | "individual";

export type SetupLoginMode = "pihole-master" | "yapd-password";

export type BaselineSummary = {
  id: string;
  name: string;
  baseUrl: string;
};

export type SetupStatus = {
  needsSetup: boolean;
  baselineConfigured: boolean;
  loginMode: SetupLoginMode | null;
  baseline: BaselineSummary | null;
};

export type SetupInstanceInput = {
  name?: string;
  baseUrl?: string;
  isMaster?: boolean;
  allowSelfSigned?: boolean;
  password?: string;
};

export type SetupBaselineRequest = {
  credentialsMode: SetupCredentialMode;
  sharedPassword?: string;
  instances: SetupInstanceInput[];
  loginMode: SetupLoginMode;
  yapdPassword?: string;
};

export type SetupBaselineResponse = {
  message: string;
  baseline: (BaselineSummary & { version: string }) | null;
  createdCount: number;
  loginMode: SetupLoginMode;
};

export type InstanceItem = {
  id: string;
  name: string;
  baseUrl: string;
  isBaseline: boolean;
  lastKnownVersion: string | null;
  lastValidatedAt: string | null;
  trustMode: string;
  hasCustomCertificate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InstanceListResponse = {
  items: InstanceItem[];
};

export type DiscoverInstanceItem = {
  baseUrl: string;
  reachable: boolean;
  authRequired: boolean;
  error?: string;
};

export type DiscoverInstancesResponse = {
  items: DiscoverInstanceItem[];
};

export type YapdSession = AppSession;
