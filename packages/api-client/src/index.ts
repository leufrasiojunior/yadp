import createClient from "openapi-fetch";

import type { paths } from "./generated/schema.js";

export type YapdApiPaths = paths;

export function createYapdApiClient(baseUrl: string, init?: Parameters<typeof createClient<paths>>[0]) {
  return createClient<paths>({
    baseUrl,
    ...(init ?? {}),
  });
}
