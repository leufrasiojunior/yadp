import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppSession } from "@/components/yapd/app-session-provider";

import { getServerApiBaseUrl } from "./base-url";
import { getApiErrorMessage } from "./error-message";
import { createYapdHttpClient, isYapdApiUnavailableResponse } from "./yapd-http";
import type {
  ClientsListResponse,
  ClientsSortDirection,
  ClientsSortField,
  DashboardOverviewResponse,
  GroupsListResponse,
  InstanceListResponse,
  QueriesResponse,
  SetupStatus,
} from "./yapd-types";

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

export async function getInstances(options?: { operationalOnly?: boolean }): Promise<InstanceListResponse> {
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

  if (options?.operationalOnly) {
    return {
      ...data,
      items: data.items.filter((instance) => instance.syncEnabled),
    };
  }

  return data;
}

export async function getGroups(): Promise<GroupsListResponse> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<GroupsListResponse>("/groups");

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    redirect("/login");
  }

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load groups.");
  }

  return data;
}

export async function getClients(query?: {
  page?: number;
  pageSize?: number;
  sortBy?: ClientsSortField;
  sortDirection?: ClientsSortDirection;
  search?: string;
  excludedTags?: string[];
}): Promise<ClientsListResponse> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<ClientsListResponse>("/clients", {
    params: {
      query: {
        ...(query?.page !== undefined ? { page: query.page } : {}),
        ...(query?.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
        ...(query?.sortBy !== undefined ? { sortBy: query.sortBy } : {}),
        ...(query?.sortDirection !== undefined ? { sortDirection: query.sortDirection } : {}),
        ...(query?.search !== undefined ? { search: query.search } : {}),
        ...(query?.excludedTags !== undefined ? { excludedTags: query.excludedTags } : {}),
      },
    },
  });

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    redirect("/login");
  }

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load clients.");
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

export async function getQueries(query: {
  scope: "all" | "instance";
  instanceId?: string;
  from?: number;
  until?: number;
  length?: number;
  start?: number;
  cursor?: number;
  domain?: string;
  client_ip?: string;
  upstream?: string;
  type?: string;
  status?: string;
  reply?: string;
  dnssec?: string;
  disk?: boolean;
}): Promise<QueriesResponse> {
  const { baseUrl, client } = await createServerApiClient();
  const { data, response } = await client.GET<QueriesResponse>("/queries", {
    params: {
      query: {
        scope: query.scope,
        ...(query.instanceId ? { instanceId: query.instanceId } : {}),
        ...(query.from !== undefined ? { from: query.from } : {}),
        ...(query.until !== undefined ? { until: query.until } : {}),
        ...(query.length !== undefined ? { length: query.length } : {}),
        ...(query.start !== undefined ? { start: query.start } : {}),
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.domain ? { domain: query.domain } : {}),
        ...(query.client_ip ? { client_ip: query.client_ip } : {}),
        ...(query.upstream ? { upstream: query.upstream } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.reply ? { reply: query.reply } : {}),
        ...(query.dnssec ? { dnssec: query.dnssec } : {}),
        ...(query.disk !== undefined ? { disk: query.disk } : {}),
      },
    },
  });

  throwIfApiUnavailable(baseUrl, response);

  if (response.status === 401) {
    redirect("/login");
  }

  await throwIfApiResponseError(baseUrl, response);

  if (!data) {
    throw new YapdApiResponseError(baseUrl, 500, "Failed to load queries.");
  }

  return data;
}
