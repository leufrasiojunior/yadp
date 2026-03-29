import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppSession } from "@/components/yapd/app-session-provider";

import { getServerApiBaseUrl } from "./base-url";
import { getApiErrorMessage } from "./error-message";
import { createYapdHttpClient, isYapdApiUnavailableResponse } from "./yapd-http";
import type { DashboardOverviewResponse, InstanceListResponse, SetupStatus } from "./yapd-types";

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

export class YapdApiResponseError extends Error {
  constructor(
    readonly baseUrl: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "YapdApiResponseError";
  }
}

export function isYapdApiResponseError(error: unknown): error is YapdApiResponseError {
  return error instanceof YapdApiResponseError;
}

function throwIfApiUnavailable(baseUrl: string, response: Response) {
  if (isYapdApiUnavailableResponse(response)) {
    throw new YapdApiUnavailableError(baseUrl);
  }
}

async function throwIfApiResponseError(baseUrl: string, response: Response) {
  if (!response.ok) {
    throw new YapdApiResponseError(baseUrl, response.status, await getApiErrorMessage(response));
  }
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<SetupStatus>("/setup/status");

  throwIfApiUnavailable(baseUrl, response);
  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load setup status.");
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

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load the active session.");
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

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load instances.");
  }

  return data;
}

export async function getDashboardOverview(query: {
  scope: "all" | "instance";
  instanceId?: string;
}): Promise<DashboardOverviewResponse> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<DashboardOverviewResponse>("/dashboard/overview", {
    params: {
      query: {
        scope: query.scope,
        ...(query.instanceId ? { instanceId: query.instanceId } : {}),
      },
    },
  });

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    redirect("/login");
  }

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load dashboard overview.");
  }

  return data;
}
