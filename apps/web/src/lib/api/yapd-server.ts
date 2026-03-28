import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppSession } from "@/components/yapd/app-session-provider";

import { getServerApiBaseUrl } from "./base-url";
import { createYapdHttpClient, isYapdApiUnavailableResponse } from "./yapd-http";
import type { InstanceListResponse, SetupStatus } from "./yapd-types";

async function createServerApiClient() {
  const baseUrl = getServerApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  return {
    baseUrl,
    client: createYapdHttpClient(baseUrl, {
      headers: cookieHeader.length > 0 ? { cookie: cookieHeader } : undefined,
    }),
  };
}

export class YapdApiUnavailableError extends Error {
  constructor(readonly baseUrl: string) {
    super(`YAPD API unavailable at ${baseUrl}`);
    this.name = "YapdApiUnavailableError";
  }
}

export function isYapdApiUnavailableError(error: unknown): error is YapdApiUnavailableError {
  return error instanceof YapdApiUnavailableError;
}

function throwIfApiUnavailable(baseUrl: string, response: Response) {
  if (isYapdApiUnavailableResponse(response)) {
    throw new YapdApiUnavailableError(baseUrl);
  }
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<SetupStatus>("/setup/status");

  throwIfApiUnavailable(baseUrl, response);

  if (!response.ok || !data) {
    throw new Error("Failed to load setup status.");
  }

  return data;
}

export async function getServerSession(required = false): Promise<AppSession | null> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<AppSession>("/session");

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    if (required) {
      redirect("/login");
    }

    return null;
  }

  if (!response.ok || !data) {
    throw new Error("Failed to load the active session.");
  }

  return data;
}

export async function getInstances(): Promise<InstanceListResponse> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<InstanceListResponse>("/instances");

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok || !data) {
    throw new Error("Failed to load instances.");
  }

  return data;
}
