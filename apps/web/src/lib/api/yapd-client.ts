import { getBrowserApiBaseUrl } from "./base-url";
import { createYapdHttpClient } from "./yapd-http";

export function getBrowserApiClient() {
  return createYapdHttpClient(getBrowserApiBaseUrl(), {
    credentials: "include",
  });
}
