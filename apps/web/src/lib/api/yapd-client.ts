import { getBrowserApiBaseUrl } from "./base-url";
import { createYapdHttpClient } from "./yapd-http";

let loginRedirectStarted = false;

export function redirectToLogin() {
  if (typeof window === "undefined" || loginRedirectStarted) {
    return;
  }

  loginRedirectStarted = true;
  window.location.replace("/login");
}

export function getBrowserApiClient(options?: Readonly<{ redirectOnUnauthorized?: boolean }>) {
  return createYapdHttpClient(getBrowserApiBaseUrl(), {
    credentials: "include",
    onUnauthorized: options?.redirectOnUnauthorized ? redirectToLogin : undefined,
  });
}

export function getAuthenticatedBrowserApiClient() {
  return getBrowserApiClient({ redirectOnUnauthorized: true });
}
