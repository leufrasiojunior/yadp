import type { ApiLocale } from "../common/i18n/locale";

export type PiholeConnection = {
  baseUrl: string;
  allowSelfSigned?: boolean;
  certificatePem?: string | null;
  locale?: ApiLocale;
};

export type PiholeSession = {
  sid: string;
  csrf: string;
  validity: number;
  totp: boolean;
};

export type PiholeVersionInfo = {
  summary: string;
  raw: unknown;
};

export type PiholeDiscoveryResult = {
  baseUrl: string;
  authRequired: boolean;
  raw: unknown;
};
