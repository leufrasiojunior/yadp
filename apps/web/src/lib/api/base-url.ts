const DEFAULT_SERVER_API_BASE_URL = "http://localhost:3001/api";
const DEFAULT_BROWSER_API_BASE_URL = "/api";

function isAbsoluteUrl(value: string | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export function getServerApiBaseUrl(): string {
  const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL;

  if (isAbsoluteUrl(internalApiBaseUrl)) {
    return internalApiBaseUrl;
  }

  const apiBaseUrl = process.env.API_BASE_URL;

  if (isAbsoluteUrl(apiBaseUrl)) {
    return apiBaseUrl;
  }

  const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (isAbsoluteUrl(publicApiBaseUrl)) {
    return publicApiBaseUrl;
  }

  return DEFAULT_SERVER_API_BASE_URL;
}

export function getBrowserApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BROWSER_API_BASE_URL;
}
