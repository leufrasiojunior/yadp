import type { AppSession } from "@/components/yapd/app-session-provider";

export type BaselineSummary = {
  id: string;
  name: string;
  baseUrl: string;
};

export type SetupStatus = {
  needsSetup: boolean;
  baselineConfigured: boolean;
  baseline: BaselineSummary | null;
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
