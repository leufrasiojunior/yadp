import type { SetupCredentialMode } from "@/lib/api/yapd-types";
import type { AppLocale } from "@/lib/i18n/config";
import {
  buildManagedInstanceBaseUrl,
  isValidManagedInstanceHostPath,
  type ManagedInstanceScheme,
  normalizeManagedInstanceHostPath,
  normalizeManagedInstanceText,
} from "@/lib/instances/managed-instance-base-url";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";

import type { SetupInstanceFormValue, SetupWizardValues } from "./setup-form.types";

export const INITIAL_INSTANCE_COUNT = 1;
export const TOTAL_STEPS = 4;

export type NormalizedSetupHostInput = {
  scheme?: ManagedInstanceScheme;
  hostPath: string;
};

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
    applicationTimeZone: PREFERENCE_DEFAULTS.time_zone,
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
  return normalizeManagedInstanceText(value);
}

function getHostPathSegment(value: string) {
  return value.split(/[/?#]/u)[0] ?? "";
}

export function normalizeSetupHostInput(value: string | null | undefined): NormalizedSetupHostInput | null {
  const normalized = normalizeText(value);

  if (normalized.length === 0) {
    return {
      hostPath: "",
    };
  }

  if (/\s/u.test(normalized)) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(normalized)) {
    let parsed: URL;

    try {
      parsed = new URL(normalized);
    } catch {
      return null;
    }

    const scheme = parsed.protocol.replace(/:$/u, "").toLowerCase();

    if (
      (scheme !== "http" && scheme !== "https") ||
      parsed.host.length === 0 ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      return null;
    }

    return {
      scheme,
      hostPath: normalizeManagedInstanceHostPath(parsed.host),
    };
  }

  if (normalized.includes("://")) {
    return null;
  }

  const hostPath = normalizeManagedInstanceHostPath(getHostPathSegment(normalized));

  if (hostPath.length === 0 && normalized.length > 0) {
    return null;
  }

  if (hostPath.includes("@")) {
    return null;
  }

  return {
    hostPath,
  };
}

export function normalizeHostPath(value: string | null | undefined) {
  return normalizeSetupHostInput(value)?.hostPath ?? normalizeManagedInstanceHostPath(value);
}

export function buildBaseUrl(scheme: SetupInstanceFormValue["scheme"], hostPath: string | null | undefined) {
  return buildManagedInstanceBaseUrl(scheme, hostPath);
}

export function isValidHostPath(scheme: SetupInstanceFormValue["scheme"], hostPath: string | null | undefined) {
  const normalized = normalizeHostPath(hostPath);

  return !normalized.includes("/") && isValidManagedInstanceHostPath(scheme, normalized);
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
