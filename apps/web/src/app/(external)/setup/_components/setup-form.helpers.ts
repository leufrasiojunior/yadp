import type { SetupCredentialMode } from "@/lib/api/yapd-types";
import type { AppLocale } from "@/lib/i18n/config";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";

import type { SetupInstanceFormValue, SetupWizardValues } from "./setup-form.types";

export const INITIAL_INSTANCE_COUNT = 1;
export const TOTAL_STEPS = 4;

export function createEmptyInstance(): SetupInstanceFormValue {
  return {
    name: "",
    scheme: "https",
    hostPath: "",
    allowSelfSigned: false,
    password: "",
  };
}

export function createDefaultSetupValues(locale: AppLocale): SetupWizardValues {
  return {
    credentialsMode: "shared" as const,
    masterIndex: 0,
    sharedPassword: "",
    instances: Array.from({ length: INITIAL_INSTANCE_COUNT }, () => createEmptyInstance()),
    loginMode: "pihole-master" as const,
    yapdPassword: "",
    confirmYapdPassword: "",
    applicationLanguage: locale,
    themePreset: PREFERENCE_DEFAULTS.theme_preset,
    font: PREFERENCE_DEFAULTS.font,
    themeMode: PREFERENCE_DEFAULTS.theme_mode,
    contentLayout: PREFERENCE_DEFAULTS.content_layout,
    navbarStyle: PREFERENCE_DEFAULTS.navbar_style,
    sidebarVariant: PREFERENCE_DEFAULTS.sidebar_variant,
    sidebarCollapsible: PREFERENCE_DEFAULTS.sidebar_collapsible,
  };
}

export function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeHostPath(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (normalized.length === 0) {
    return "";
  }

  return normalized.replace(/\/+$/u, "");
}

export function buildBaseUrl(scheme: SetupInstanceFormValue["scheme"], hostPath: string | null | undefined) {
  return `${scheme}://${normalizeHostPath(hostPath)}`;
}

export function isValidHostPath(scheme: SetupInstanceFormValue["scheme"], hostPath: string | null | undefined) {
  const normalized = normalizeHostPath(hostPath);

  if (normalized.length === 0 || normalized.includes("://")) {
    return false;
  }

  try {
    const parsed = new URL(buildBaseUrl(scheme, normalized));
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export function isBlankInstance(instance: SetupInstanceFormValue, mode: SetupCredentialMode) {
  const name = normalizeText(instance.name);
  const hostPath = normalizeHostPath(instance.hostPath);

  if (mode === "shared") {
    return name.length === 0 && hostPath.length === 0 && !instance.allowSelfSigned;
  }

  const password = normalizeText(instance.password);

  return name.length === 0 && hostPath.length === 0 && !instance.allowSelfSigned && password.length === 0;
}
