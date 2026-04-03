export type ManagedInstanceScheme = "http" | "https";

export function normalizeManagedInstanceText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeManagedInstanceHostPath(value: string | null | undefined) {
  const normalized = normalizeManagedInstanceText(value);

  if (normalized.length === 0) {
    return "";
  }

  return normalized.replace(/\/+$/u, "");
}

export function buildManagedInstanceBaseUrl(scheme: ManagedInstanceScheme, hostPath: string | null | undefined) {
  return `${scheme}://${normalizeManagedInstanceHostPath(hostPath)}`;
}

export function isValidManagedInstanceHostPath(scheme: ManagedInstanceScheme, hostPath: string | null | undefined) {
  const normalized = normalizeManagedInstanceHostPath(hostPath);

  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.includes("://") ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    /\s/u.test(normalized)
  ) {
    return false;
  }

  try {
    const parsed = new URL(buildManagedInstanceBaseUrl(scheme, normalized));

    return (
      parsed.protocol === `${scheme}:` &&
      parsed.hostname.trim().length > 0 &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.search.length === 0 &&
      parsed.hash.length === 0
    );
  } catch {
    return false;
  }
}

export function normalizeManagedInstanceBaseUrl(baseUrl: string | null | undefined) {
  const normalized = normalizeManagedInstanceText(baseUrl);
  const match = /^(https?):\/\/(.*)$/iu.exec(normalized);

  if (!match) {
    return null;
  }

  const scheme = (match[1]?.toLowerCase() ?? "") as ManagedInstanceScheme;
  const hostPath = normalizeManagedInstanceHostPath(match[2] ?? "");

  if (!isValidManagedInstanceHostPath(scheme, hostPath)) {
    return null;
  }

  return buildManagedInstanceBaseUrl(scheme, hostPath);
}

export function splitManagedInstanceBaseUrl(baseUrl: string | null | undefined) {
  const normalizedBaseUrl = normalizeManagedInstanceBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return null;
  }

  const parsed = new URL(normalizedBaseUrl);
  const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname;

  return {
    scheme: parsed.protocol === "http:" ? ("http" as const) : ("https" as const),
    hostPath: `${parsed.host}${normalizedPath}`,
  };
}
