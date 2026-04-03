export class InvalidManagedInstanceBaseUrlError extends Error {
  constructor(
    message = "Provide a valid http:// or https:// base URL with host and optional path, without duplicate protocol.",
  ) {
    super(message);
    this.name = "InvalidManagedInstanceBaseUrlError";
  }
}

function normalizeManagedInstanceBaseUrlInput(baseUrl: string) {
  const trimmed = baseUrl.trim();
  const match = /^(https?):\/\/(.*)$/iu.exec(trimmed);

  if (!match) {
    throw new InvalidManagedInstanceBaseUrlError();
  }

  const scheme = match[1]?.toLowerCase();
  const remainder = match[2]?.trim() ?? "";

  if (
    !scheme ||
    remainder.length === 0 ||
    remainder.startsWith("/") ||
    remainder.includes("://") ||
    /\s/u.test(remainder)
  ) {
    throw new InvalidManagedInstanceBaseUrlError();
  }

  return {
    scheme,
    remainder,
  };
}

export function normalizeManagedInstanceBaseUrl(baseUrl: string) {
  const { scheme, remainder } = normalizeManagedInstanceBaseUrlInput(baseUrl);
  const parsed = new URL(`${scheme}://${remainder}`);

  if (
    parsed.protocol !== `${scheme}:` ||
    parsed.hostname.trim().length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new InvalidManagedInstanceBaseUrlError();
  }

  const normalizedPath = parsed.pathname.replaceAll(/\/{2,}/g, "/");

  parsed.protocol = `${scheme}:`;
  parsed.username = "";
  parsed.password = "";
  parsed.pathname =
    normalizedPath.length > 1 && normalizedPath.endsWith("/") ? normalizedPath.slice(0, -1) : normalizedPath;
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/u, "");
}

export function isManagedInstanceBaseUrl(baseUrl: unknown) {
  if (typeof baseUrl !== "string") {
    return false;
  }

  try {
    normalizeManagedInstanceBaseUrl(baseUrl);
    return true;
  } catch {
    return false;
  }
}
