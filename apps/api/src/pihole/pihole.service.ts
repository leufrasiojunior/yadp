import { Inject, Injectable, Logger } from "@nestjs/common";
import { Agent, fetch } from "undici";

import { DEFAULT_API_LOCALE } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { AppEnvService } from "../config/app-env";
import type {
  PiholeAuthSessionRecord,
  PiholeBlockingConfig,
  PiholeBlockingRequest,
  PiholeClientActivitySeries,
  PiholeClientCreateRequest,
  PiholeClientHistoryBucket,
  PiholeClientListResult,
  PiholeClientMutationResult,
  PiholeClientSuggestionsResult,
  PiholeClientUpdateRequest,
  PiholeConnection,
  PiholeDiscoveryResult,
  PiholeDomainOperationRequest,
  PiholeDomainOperationResult,
  PiholeGroupCreateRequest,
  PiholeGroupListResult,
  PiholeGroupMutationResult,
  PiholeGroupUpdateRequest,
  PiholeHistoryPoint,
  PiholeListCreateRequest,
  PiholeListListResult,
  PiholeListMutationResult,
  PiholeListType,
  PiholeListUpdateRequest,
  PiholeManagedClientEntry,
  PiholeManagedDomainEntry,
  PiholeManagedGroupEntry,
  PiholeManagedListEntry,
  PiholeMetricsSummary,
  PiholeNetworkDevice,
  PiholeNetworkDeviceAddress,
  PiholeNetworkDevicesResult,
  PiholeQueryListRequest,
  PiholeQueryListResult,
  PiholeQueryLogEntry,
  PiholeQuerySuggestions,
  PiholeQuerySuggestionsResult,
  PiholeRequestErrorKind,
  PiholeSession,
  PiholeVersionInfo,
} from "./pihole.types";
import { PIHOLE_QUERY_SUGGESTION_KEYS } from "./pihole.types";

const PIHOLE_USER_AGENT = "YAPD";
const DEFAULT_NETWORK_DEVICE_MAX_DEVICES = 999;
const DEFAULT_NETWORK_DEVICE_MAX_ADDRESSES = 25;

const TLS_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

type QueryParamValue = string | number | boolean;

type PiholeErrorPayload = {
  error?: {
    message?: string;
    key?: string;
  };
};

type SerializedTransportError = {
  name: string;
  message: string;
  code?: string;
  causeName?: string;
  causeMessage?: string;
  causeCode?: string;
  errno?: number;
  syscall?: string;
  address?: string;
  port?: number;
};

type ClientSeriesAccumulator = {
  label: string;
  totalQueries: number;
  points: Map<number, number>;
};

type NormalizedLookup = Map<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true" || value === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return null;
}

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => readNumber(item)).filter((item): item is number => item !== null);
}

function readFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = readNumber(record[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(record[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readNumericArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const numbers: number[] = [];

  for (const item of value) {
    const parsed = readNumber(item);

    if (parsed === null) {
      return null;
    }

    numbers.push(parsed);
  }

  return numbers;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: string[] = [];

  for (const item of value) {
    const normalized = readString(item);

    if (!normalized) {
      continue;
    }

    items.push(normalized);
  }

  return items;
}

function normalizeLookupKey(value: string) {
  return value.replaceAll(/[^a-z0-9]+/gi, "").toLowerCase();
}

function createLookup(record: Record<string, unknown>): NormalizedLookup {
  const lookup: NormalizedLookup = new Map();

  for (const [key, value] of Object.entries(record)) {
    lookup.set(normalizeLookupKey(key), value);
  }

  return lookup;
}

function readLookupValue(lookup: NormalizedLookup, aliases: string[]) {
  for (const alias of aliases) {
    const value = lookup.get(normalizeLookupKey(alias));

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readLookupString(lookup: NormalizedLookup, aliases: string[]) {
  return readString(readLookupValue(lookup, aliases));
}

function readLookupNumber(lookup: NormalizedLookup, aliases: string[]) {
  return readNumber(readLookupValue(lookup, aliases));
}

function readLookupNumberArray(lookup: NormalizedLookup, aliases: string[]) {
  return readNumberArray(readLookupValue(lookup, aliases));
}

function readLookupBoolean(lookup: NormalizedLookup, aliases: string[]) {
  return readBoolean(readLookupValue(lookup, aliases));
}

function readLookupRecord(lookup: NormalizedLookup, aliases: string[]) {
  const value = readLookupValue(lookup, aliases);
  return isRecord(value) ? value : null;
}

function normalizeClientSeriesKey(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "client";
}

let piholeRequestSequence = 0;

export class PiholeRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly kind: PiholeRequestErrorKind,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class PiholeService {
  private readonly logger = new Logger(PiholeService.name);
  private readonly requestTimeoutMs: number;

  constructor(@Inject(AppEnvService) env: AppEnvService) {
    this.requestTimeoutMs = env.values.PIHOLE_REQUEST_TIMEOUT_MS;
  }

  async checkAuthenticationRequired(connection: PiholeConnection): Promise<PiholeDiscoveryResult> {
    const payload = await this.request<unknown>(connection, "/auth");
    const authRequired =
      typeof payload === "object" &&
      payload !== null &&
      "session" in payload &&
      typeof payload.session === "object" &&
      payload.session !== null &&
      "valid" in payload.session
        ? !(payload.session as { valid?: boolean }).valid
        : true;

    return {
      baseUrl: connection.baseUrl,
      authRequired,
      raw: payload,
    };
  }

  async authenticate(connection: PiholeConnection, password: string, totp?: string): Promise<PiholeSession> {
    const payload = await this.request<{ session: PiholeSession }>(connection, "/auth", {
      method: "POST",
      body: {
        password,
        ...(totp ? { totp } : {}),
      },
    });

    return payload.session;
  }

  async logout(connection: PiholeConnection, sid: string) {
    await this.request<void>(connection, "/auth", {
      method: "DELETE",
      sid,
    });
  }

  async listSessions(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeAuthSessionRecord[]> {
    const payload = await this.request<unknown>(connection, "/auth/sessions", {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeAuthSessions(payload, connection);
  }

  async getCurrentSessionDetails(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeAuthSessionRecord | null> {
    const sessions = await this.listSessions(connection, session);

    return sessions.find((item) => item.currentSession) ?? null;
  }

  async deleteSessionById(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    sessionId: number,
  ) {
    await this.request<void>(connection, `/auth/session/${sessionId}`, {
      method: "DELETE",
      sid: session.sid,
      csrf: session.csrf,
    });
  }

  async healthCheck(connection: PiholeConnection, session?: Pick<PiholeSession, "sid" | "csrf">) {
    const version = await this.readCapabilities(connection, session);

    return {
      ok: true,
      version: version.summary,
    };
  }

  async readCapabilities(
    connection: PiholeConnection,
    session?: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeVersionInfo> {
    const payload = await this.request<unknown>(connection, "/info/version", {
      sid: session?.sid,
      csrf: session?.csrf,
    });

    return {
      summary: this.extractVersionSummary(payload, connection.locale),
      raw: payload,
    };
  }

  async discoverClients(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeNetworkDevicesResult> {
    return this.listNetworkDevices(connection, session);
  }

  async listNetworkDevices(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    options?: { maxDevices?: number; maxAddresses?: number; cacheBust?: number },
  ): Promise<PiholeNetworkDevicesResult> {
    const path = "/network/devices";
    const payload = await this.request<unknown>(connection, path, {
      sid: session.sid,
      csrf: session.csrf,
      query: {
        max_devices: options?.maxDevices ?? DEFAULT_NETWORK_DEVICE_MAX_DEVICES,
        max_addresses: options?.maxAddresses ?? DEFAULT_NETWORK_DEVICE_MAX_ADDRESSES,
        _: options?.cacheBust ?? Date.now(),
      },
    });

    return this.normalizeNetworkDevices(payload, connection, path);
  }

  async fetchSnapshot(connection: PiholeConnection, session: Pick<PiholeSession, "sid" | "csrf">) {
    const [blocking, groups] = await Promise.all([
      this.getBlocking(connection, session),
      this.request<unknown>(connection, "/groups", {
        sid: session.sid,
        csrf: session.csrf,
      }),
    ]);

    return {
      blocking,
      groups,
    };
  }

  async getBlocking(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeBlockingConfig> {
    const payload = await this.request<unknown>(connection, "/dns/blocking", {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeBlockingConfig(payload, connection, "/dns/blocking");
  }

  async setBlocking(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    config: PiholeBlockingRequest,
  ): Promise<PiholeBlockingConfig> {
    const payload = await this.request<unknown>(connection, "/dns/blocking", {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        blocking: config.blocking,
        timer: config.timer,
      },
    });

    return this.normalizeBlockingConfig(payload, connection, "/dns/blocking");
  }

  async getStatsSummary(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeMetricsSummary> {
    const payload = await this.request<unknown>(connection, "/stats/summary", {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeStatsSummary(payload, connection);
  }

  async getHistory(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeHistoryPoint[]> {
    const payload = await this.request<unknown>(connection, "/history", {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeHistoryPoints(payload, connection, "/history");
  }

  async getHistoryClients(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    options?: { maxClients?: number },
  ): Promise<PiholeClientActivitySeries[]> {
    const payload = await this.request<unknown>(connection, "/history/clients", {
      sid: session.sid,
      csrf: session.csrf,
      query: {
        ...(options?.maxClients !== undefined ? { N: options.maxClients } : {}),
      },
    });

    return this.normalizeClientActivity(payload, connection, "/history/clients");
  }

  async getQueries(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    filters?: PiholeQueryListRequest,
  ): Promise<PiholeQueryListResult> {
    const payload = await this.request<unknown>(connection, "/queries", {
      sid: session.sid,
      csrf: session.csrf,
      query: {
        ...(filters?.from !== undefined ? { from: filters.from } : {}),
        ...(filters?.until !== undefined ? { until: filters.until } : {}),
        ...(filters?.length !== undefined ? { length: filters.length } : {}),
        ...(filters?.start !== undefined ? { start: filters.start } : {}),
        ...(filters?.cursor !== undefined ? { cursor: filters.cursor } : {}),
        ...(filters?.domain ? { domain: filters.domain } : {}),
        ...(filters?.clientIp ? { client_ip: filters.clientIp } : {}),
        ...(filters?.upstream ? { upstream: filters.upstream } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.reply ? { reply: filters.reply } : {}),
        ...(filters?.dnssec ? { dnssec: filters.dnssec } : {}),
        ...(filters?.disk !== undefined ? { disk: filters.disk } : {}),
      },
    });

    return this.normalizeQueryList(payload, connection, "/queries");
  }

  async getQuerySuggestions(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeQuerySuggestionsResult> {
    const payload = await this.request<unknown>(connection, "/queries/suggestions", {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeQuerySuggestions(payload, connection, "/queries/suggestions");
  }

  async applyDomainOperation(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    operation: PiholeDomainOperationRequest,
  ): Promise<PiholeDomainOperationResult> {
    const path = `/domains/${operation.type}/${operation.kind}`;
    const payload = await this.request<unknown>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        domain: operation.value,
        ...(operation.comment !== undefined ? { comment: operation.comment } : {}),
        groups: operation.groups ?? [0],
        enabled: operation.enabled ?? true,
      },
    });

    return this.normalizeDomainOperation(payload, connection, path);
  }

  async listGroups(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    name?: string,
  ): Promise<PiholeGroupListResult> {
    const path = name ? `/groups/${encodeURIComponent(name)}` : "/groups";
    const payload = await this.request<unknown>(connection, path, {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeGroupList(payload, connection, path);
  }

  async listLists(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    address?: string,
    type?: PiholeListType,
  ): Promise<PiholeListListResult> {
    const path = address ? `/lists/${encodeURIComponent(address)}` : "/lists";
    const payload = await this.request<unknown>(connection, path, {
      sid: session.sid,
      csrf: session.csrf,
      query: type ? { type } : undefined,
    });

    return this.normalizeListList(payload, connection, path);
  }

  async createLists(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    request: PiholeListCreateRequest,
  ): Promise<PiholeListMutationResult> {
    const path = "/lists";
    const payload = await this.request<unknown>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      query: {
        type: request.type,
      },
      body: {
        address: request.address,
        comment: request.comment ?? "",
        type: request.type,
        groups: request.groups,
        enabled: request.enabled ?? true,
      },
    });

    if (payload === undefined) {
      return {
        lists: [],
        processed: {
          errors: [],
          success: [{ item: request.address }],
        },
        took: 0,
      };
    }

    return this.normalizeListMutation(payload, connection, path);
  }

  async updateList(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    address: string,
    request: PiholeListUpdateRequest,
  ): Promise<PiholeListMutationResult> {
    const path = `/lists/${encodeURIComponent(address)}`;
    const payload = await this.request<unknown>(connection, path, {
      method: "PUT",
      sid: session.sid,
      csrf: session.csrf,
      query: {
        type: request.type,
      },
      body: {
        comment: request.comment ?? "",
        type: request.type,
        groups: request.groups,
        enabled: request.enabled,
      },
    });

    if (payload === undefined) {
      return {
        lists: [],
        processed: {
          errors: [],
          success: [{ item: address }],
        },
        took: 0,
      };
    }

    return this.normalizeListMutation(payload, connection, path);
  }

  async deleteList(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    address: string,
    type: PiholeListType,
  ): Promise<PiholeListMutationResult> {
    const path = `/lists/${encodeURIComponent(address)}`;
    const payload = await this.request<unknown>(connection, path, {
      method: "DELETE",
      sid: session.sid,
      csrf: session.csrf,
      query: {
        type,
      },
    });

    if (payload === undefined) {
      return {
        lists: [],
        processed: {
          errors: [],
          success: [{ item: address }],
        },
        took: 0,
      };
    }

    return this.normalizeListMutation(payload, connection, path);
  }

  async createGroups(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    request: PiholeGroupCreateRequest,
  ): Promise<PiholeGroupMutationResult> {
    const path = "/groups";
    const payload = await this.request<unknown>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        name: request.names.length === 1 ? request.names[0] : request.names,
        ...(request.comment !== undefined ? { comment: request.comment } : {}),
        enabled: request.enabled ?? true,
      },
    });

    return this.normalizeGroupMutation(payload, connection, path);
  }

  async updateGroup(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    currentName: string,
    request: PiholeGroupUpdateRequest,
  ): Promise<PiholeGroupMutationResult> {
    const path = `/groups/${encodeURIComponent(currentName)}`;
    const payload = await this.request<unknown>(connection, path, {
      method: "PUT",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        name: request.name,
        comment: request.comment ?? "",
        enabled: request.enabled,
      },
    });

    return this.normalizeGroupMutation(payload, connection, path);
  }

  async setGroupEnabled(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    group: { name: string; comment?: string | null },
    enabled: boolean,
  ): Promise<PiholeGroupMutationResult> {
    return this.updateGroup(connection, session, group.name, {
      name: group.name,
      comment: group.comment ?? "",
      enabled,
    });
  }

  async deleteGroup(connection: PiholeConnection, session: Pick<PiholeSession, "sid" | "csrf">, name: string) {
    const path = `/groups/${encodeURIComponent(name)}`;

    await this.request<void>(connection, path, {
      method: "DELETE",
      sid: session.sid,
      csrf: session.csrf,
    });
  }

  async batchDeleteGroups(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    items: string[],
  ): Promise<PiholeGroupMutationResult> {
    const path = "/groups:batchDelete";
    const payload = await this.request<unknown | undefined>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: items.map((item) => ({ item })),
    });

    if (payload === undefined) {
      return {
        groups: [],
        processed: {
          errors: [],
          success: items.map((item) => ({ item })),
        },
        took: null,
      };
    }

    return this.normalizeGroupMutation(payload, connection, path);
  }

  async listClients(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    client?: string,
  ): Promise<PiholeClientListResult> {
    const path = client ? `/clients/${encodeURIComponent(client)}` : "/clients";
    const payload = await this.request<unknown>(connection, path, {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeClientList(payload, connection, path);
  }

  async getClientSuggestions(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeClientSuggestionsResult> {
    const path = "/clients/_suggestions";
    const payload = await this.request<unknown>(connection, path, {
      sid: session.sid,
      csrf: session.csrf,
    });

    return this.normalizeClientSuggestions(payload, connection, path);
  }

  async createClients(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    request: PiholeClientCreateRequest,
  ): Promise<PiholeClientMutationResult> {
    const path = "/clients";
    const payload = await this.request<unknown>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        client: request.clients.length === 1 ? request.clients[0] : request.clients,
        comment: request.comment ?? "",
        groups: request.groups,
      },
    });

    return this.normalizeClientMutation(payload, connection, path);
  }

  async updateClient(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    client: string,
    request: PiholeClientUpdateRequest,
  ): Promise<PiholeClientMutationResult> {
    const path = `/clients/${encodeURIComponent(client)}`;
    const payload = await this.request<unknown>(connection, path, {
      method: "PUT",
      sid: session.sid,
      csrf: session.csrf,
      body: {
        comment: request.comment ?? "",
        groups: request.groups,
      },
    });

    return this.normalizeClientMutation(payload, connection, path);
  }

  async deleteClient(connection: PiholeConnection, session: Pick<PiholeSession, "sid" | "csrf">, client: string) {
    const path = `/clients/${encodeURIComponent(client)}`;

    await this.request<void>(connection, path, {
      method: "DELETE",
      sid: session.sid,
      csrf: session.csrf,
    });
  }

  async batchDeleteClients(
    connection: PiholeConnection,
    session: Pick<PiholeSession, "sid" | "csrf">,
    items: string[],
  ): Promise<PiholeClientMutationResult> {
    const path = "/clients:batchDelete";
    const payload = await this.request<unknown | undefined>(connection, path, {
      method: "POST",
      sid: session.sid,
      csrf: session.csrf,
      body: items.map((item) => ({ item })),
    });

    if (payload === undefined) {
      return {
        clients: [],
        processed: {
          errors: [],
          success: items.map((item) => ({ item })),
        },
        took: null,
      };
    }

    return this.normalizeClientMutation(payload, connection, path);
  }

  async applyCanonicalConfig() {
    throw new Error("Canonical config sync is not implemented in slice 1");
  }

  private async request<T>(
    connection: PiholeConnection,
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      query?: Record<string, QueryParamValue | null | undefined>;
      sid?: string;
      csrf?: string;
    },
  ): Promise<T> {
    const method = options?.method ?? "GET";
    const requestId = ++piholeRequestSequence;
    const startedAt = Date.now();
    const normalizedBaseUrl = this.normalizeBaseUrl(connection.baseUrl);
    const displayBaseUrl = normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl.slice(0, -1) : normalizedBaseUrl;
    const headers = new Headers({
      Accept: "application/json",
      "User-Agent": PIHOLE_USER_AGENT,
    });

    if (options?.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options?.sid) {
      headers.set("X-FTL-SID", options.sid);
    }

    if (options?.csrf) {
      headers.set("X-FTL-CSRF", options.csrf);
    }

    const url = new URL(`/api${path}`, normalizedBaseUrl);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === null || value === undefined) {
          continue;
        }

        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Awaited<ReturnType<typeof fetch>>;
    this.logger.debug(`Pi-hole request ${method} ${url.toString()} (timeout=${this.requestTimeoutMs}ms)`);
    this.logger.verbose(
      `[req:${requestId}] Pi-hole request start method=${method} requestUrl=${url.toString()} configuredBaseUrl=${connection.baseUrl} normalizedBaseUrl=${displayBaseUrl}`,
    );

    try {
      response = await fetch(url, {
        method,
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        dispatcher: new Agent({
          connect: {
            rejectUnauthorized: !(connection.allowSelfSigned ?? false),
            ...(connection.certificatePem ? { ca: connection.certificatePem } : {}),
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const transport = this.describeTransportError(displayBaseUrl, error, connection.locale);
      this.logger.error(
        `Pi-hole transport error for ${method} ${url.toString()}: ${transport.kind} - ${transport.message}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.logger.warn(
        `[req:${requestId}] Pi-hole transport failure after ${Date.now() - startedAt}ms method=${method} requestUrl=${url.toString()} configuredBaseUrl=${connection.baseUrl} normalizedBaseUrl=${displayBaseUrl} kind=${transport.kind} raw=${JSON.stringify(transport.rawCause)}`,
      );

      throw new PiholeRequestError(502, transport.message, transport.kind, {
        cause: this.serializeTransportError(error),
        requestId,
        requestUrl: url.toString(),
        configuredBaseUrl: connection.baseUrl,
        normalizedBaseUrl: displayBaseUrl,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let payload: unknown;

    if (text.length > 0) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = {
          raw: text,
        };
      }
    }

    if (!response.ok) {
      const errorPayload = payload as PiholeErrorPayload | undefined;
      const kind = path === "/auth" && response.status === 401 ? "invalid_credentials" : "pihole_response_error";
      const message = errorPayload?.error?.message ?? response.statusText;
      this.logger.warn(
        `Pi-hole response error for ${method} ${url.toString()}: HTTP ${response.status} (${kind}) - ${message}`,
      );
      this.logger.warn(
        `[req:${requestId}] Pi-hole response failure after ${Date.now() - startedAt}ms method=${method} requestUrl=${url.toString()} status=${response.status} kind=${kind}`,
      );

      throw new PiholeRequestError(response.status, message, kind, payload);
    }

    this.logger.verbose(`Pi-hole request ${method} ${url.toString()} completed with HTTP ${response.status}.`);
    this.logger.verbose(
      `[req:${requestId}] Pi-hole request success after ${Date.now() - startedAt}ms method=${method} requestUrl=${url.toString()} status=${response.status}`,
    );

    return payload as T;
  }

  private describeTransportError(
    baseUrl: string,
    error: unknown,
    locale = DEFAULT_API_LOCALE,
  ): { kind: PiholeRequestErrorKind; message: string; rawCause: SerializedTransportError } {
    const reason = this.serializeTransportError(error);

    if (
      reason.code === "UND_ERR_SOCKET" ||
      reason.causeCode === "UND_ERR_SOCKET" ||
      reason.causeMessage?.toLowerCase().includes("other side closed")
    ) {
      return {
        kind: "unknown",
        message: translateApi(locale, "pihole.socketClosed", { baseUrl }),
        rawCause: reason,
      };
    }

    if (reason.name === "AbortError" || reason.code === "ETIMEDOUT" || reason.code === "UND_ERR_CONNECT_TIMEOUT") {
      return {
        kind: "timeout",
        message: translateApi(locale, "pihole.timeout", { baseUrl }),
        rawCause: reason,
      };
    }

    if (reason.code === "ECONNREFUSED") {
      return {
        kind: "connection_refused",
        message: translateApi(locale, "pihole.refused", { baseUrl }),
        rawCause: reason,
      };
    }

    if (reason.code === "ENOTFOUND" || reason.code === "EAI_AGAIN") {
      return {
        kind: "dns_error",
        message: translateApi(locale, "pihole.unresolved", { baseUrl }),
        rawCause: reason,
      };
    }

    if (this.isTlsTransportError(reason)) {
      return {
        kind: "tls_error",
        message: translateApi(locale, "pihole.tls", { baseUrl }),
        rawCause: reason,
      };
    }

    return {
      kind: "unknown",
      message: translateApi(locale, "pihole.unreachable", { baseUrl }),
      rawCause: reason,
    };
  }

  private serializeTransportError(error: unknown): SerializedTransportError {
    if (error instanceof Error) {
      const maybeError = error as Error & {
        code?: string;
        errno?: number;
        syscall?: string;
        address?: string;
        port?: number;
        cause?: {
          name?: string;
          code?: string;
          errno?: number;
          syscall?: string;
          address?: string;
          port?: number;
          message?: string;
        };
      };

      return {
        name: maybeError.name,
        message: maybeError.message,
        code: maybeError.code ?? maybeError.cause?.code,
        causeName: maybeError.cause?.name,
        causeMessage: maybeError.cause?.message,
        causeCode: maybeError.cause?.code,
        errno: maybeError.errno ?? maybeError.cause?.errno,
        syscall: maybeError.syscall ?? maybeError.cause?.syscall,
        address: maybeError.address ?? maybeError.cause?.address,
        port: maybeError.port ?? maybeError.cause?.port,
      };
    }

    return {
      name: "UnknownError",
      message: "Unknown transport error",
      code: undefined,
    };
  }

  private isTlsTransportError(reason: SerializedTransportError) {
    if (reason.code && TLS_ERROR_CODES.has(reason.code)) {
      return true;
    }

    const normalizedMessage = reason.message.toLowerCase();

    return normalizedMessage.includes("certificate") || normalizedMessage.includes("tls");
  }

  private normalizeStatsSummary(payload: unknown, connection: PiholeConnection): PiholeMetricsSummary {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, "/stats/summary", payload);
    }

    const queriesSection = isRecord(payload.queries) ? payload.queries : null;
    const gravitySection = isRecord(payload.gravity) ? payload.gravity : null;
    const totalQueries =
      readFirstNumber(payload, ["dns_queries_today", "total_queries", "queries"]) ??
      (queriesSection ? readFirstNumber(queriesSection, ["total", "queries"]) : null);
    const queriesBlocked =
      readFirstNumber(payload, ["ads_blocked_today", "blocked_queries", "queries_blocked", "blocked"]) ??
      (queriesSection ? readFirstNumber(queriesSection, ["blocked", "ads_blocked", "blocked_queries"]) : null);
    const percentageBlocked =
      readFirstNumber(payload, ["ads_percentage_today", "percentage_blocked", "blocked_percentage"]) ??
      (queriesSection ? readFirstNumber(queriesSection, ["percentage_blocked", "blocked_percentage"]) : null);
    const domainsOnList =
      readFirstNumber(payload, ["domains_being_blocked", "domains_on_list"]) ??
      (gravitySection ? readFirstNumber(gravitySection, ["domains_being_blocked", "domains_on_list"]) : null);

    if (totalQueries === null || queriesBlocked === null || domainsOnList === null) {
      throw this.createInvalidResponseError(connection, "/stats/summary", payload);
    }

    return {
      totalQueries,
      queriesBlocked,
      percentageBlocked: percentageBlocked ?? (totalQueries > 0 ? (queriesBlocked / totalQueries) * 100 : 0),
      domainsOnList,
    };
  }

  private normalizeBlockingConfig(payload: unknown, connection: PiholeConnection, path: string): PiholeBlockingConfig {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const blockingValue = readString(payload.blocking);
    const timerValue = payload.timer === null ? null : readNumber(payload.timer);
    const took = readNumber(payload.took);

    if ((blockingValue !== "enabled" && blockingValue !== "disabled") || took === null) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    if (payload.timer !== null && timerValue === null) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      blocking: blockingValue,
      timer: timerValue === null ? null : Math.max(0, Math.floor(timerValue)),
      took,
    };
  }

  private normalizeQueryList(payload: unknown, connection: PiholeConnection, path: string): PiholeQueryListResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const lookup = createLookup(payload);
    const rawQueries = readLookupValue(lookup, ["queries", "query", "items", "results"]);

    if (!Array.isArray(rawQueries)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const queries: PiholeQueryLogEntry[] = [];

    for (const rawQuery of rawQueries) {
      if (!isRecord(rawQuery)) {
        throw this.createInvalidResponseError(connection, path, payload);
      }

      queries.push(this.normalizeQueryEntry(rawQuery, connection, path, payload));
    }

    return {
      queries: queries.sort((left, right) => right.time - left.time || right.id - left.id),
      cursor: readLookupNumber(lookup, ["cursor", "next_cursor", "latest_cursor"]),
      recordsTotal:
        readLookupNumber(lookup, ["recordsTotal", "records_total", "total", "total_records"]) ?? queries.length,
      recordsFiltered:
        readLookupNumber(lookup, ["recordsFiltered", "records_filtered", "filtered", "filtered_records"]) ??
        queries.length,
      earliestTimestamp:
        readLookupNumber(lookup, ["earliestTimestamp", "earliest_timestamp", "firstTimestamp", "first_timestamp"]) ??
        null,
      earliestTimestampDisk:
        readLookupNumber(lookup, [
          "earliestTimestampDisk",
          "earliest_timestamp_disk",
          "firstTimestampDisk",
          "first_timestamp_disk",
        ]) ?? null,
      took: readLookupNumber(lookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeQueryEntry(
    payload: Record<string, unknown>,
    connection: PiholeConnection,
    path: string,
    fullPayload: unknown,
  ): PiholeQueryLogEntry {
    const lookup = createLookup(payload);
    const id = readLookupNumber(lookup, ["id", "query_id", "queryId"]);
    const time = readLookupNumber(lookup, ["time", "timestamp", "ts"]);

    if (id === null || time === null) {
      throw this.createInvalidResponseError(connection, path, fullPayload);
    }

    const replyRecord = readLookupRecord(lookup, ["reply", "response", "answer"]);
    const clientRecord = readLookupRecord(lookup, ["client", "requester", "source"]);
    const edeRecord = readLookupRecord(lookup, ["ede", "extended_dns_error", "extendedDnsError"]);
    const rawReplyValue = readLookupValue(lookup, ["reply", "response", "answer"]);
    const rawClientValue = readLookupValue(lookup, ["client", "requester", "source"]);

    return {
      id,
      time,
      type: readLookupString(lookup, ["type", "query_type", "queryType"]),
      status: readLookupString(lookup, ["status", "query_status", "queryStatus"]),
      dnssec: readLookupString(lookup, ["dnssec", "dnssec_status", "dnssecStatus"]),
      domain: readLookupString(lookup, ["domain", "query", "name", "hostname"]),
      upstream: readLookupString(lookup, ["upstream", "resolver", "forwarded_to", "forwardedTo"]),
      reply: replyRecord
        ? {
            type: readFirstString(replyRecord, ["type", "reply_type", "replyType", "kind"]),
            time: readFirstNumber(replyRecord, ["time", "took", "duration", "elapsed"]),
          }
        : readString(rawReplyValue)
          ? {
              type: readString(rawReplyValue),
              time: null,
            }
          : null,
      client: clientRecord
        ? {
            ip: readFirstString(clientRecord, ["ip", "client_ip", "clientIp", "address"]),
            name: readFirstString(clientRecord, ["name", "client_name", "clientName", "hostname"]),
          }
        : readString(rawClientValue)
          ? {
              ip: readString(rawClientValue),
              name: null,
            }
          : null,
      listId: readLookupNumber(lookup, ["list_id", "listId", "list"]),
      ede: edeRecord
        ? {
            code: readFirstNumber(edeRecord, ["code", "ede_code", "edeCode", "id"]),
            text: readFirstString(edeRecord, ["text", "message", "description"]),
          }
        : null,
      cname: readLookupString(lookup, ["cname", "canonical_name", "canonicalName"]),
    };
  }

  private normalizeQuerySuggestions(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeQuerySuggestionsResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawSuggestions =
      readLookupRecord(payloadLookup, ["suggestions", "filters", "values"]) ??
      (Object.keys(payload).length > 0 ? payload : null);

    if (!rawSuggestions) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const suggestionsLookup = createLookup(rawSuggestions);
    const suggestions = {} as PiholeQuerySuggestions;

    for (const key of PIHOLE_QUERY_SUGGESTION_KEYS) {
      suggestions[key] = this.readSuggestionValues(suggestionsLookup, key);
    }

    return {
      suggestions,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeDomainOperation(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeDomainOperationResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawDomains = readLookupValue(payloadLookup, ["domains", "domain", "items", "results"]);
    const rawProcessed = readLookupRecord(payloadLookup, ["processed", "result", "summary"]);
    const domains = Array.isArray(rawDomains)
      ? rawDomains
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => this.normalizeManagedDomain(item))
      : [];
    const processed = this.normalizeDomainOperationProcessed(rawProcessed);

    if (domains.length === 0 && processed.errors.length === 0 && processed.success.length === 0) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      domains,
      processed,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeManagedDomain(payload: Record<string, unknown>): PiholeManagedDomainEntry {
    const lookup = createLookup(payload);

    return {
      domain: readLookupString(lookup, ["domain", "item", "value", "name"]),
      unicode:
        readLookupString(lookup, ["unicode", "unicode_domain", "unicodeDomain"]) ??
        readLookupString(lookup, ["domain", "item", "value", "name"]),
      type: readLookupString(lookup, ["type"]),
      kind: readLookupString(lookup, ["kind"]),
      comment: readLookupString(lookup, ["comment", "note", "description"]),
      groups: readNumericArray(readLookupValue(lookup, ["groups", "group_ids", "groupIds"])) ?? [],
      enabled: readBoolean(readLookupValue(lookup, ["enabled", "active"])),
      id: readLookupNumber(lookup, ["id"]),
      dateAdded: readLookupNumber(lookup, ["date_added", "dateAdded", "created_at", "createdAt"]),
      dateModified: readLookupNumber(lookup, ["date_modified", "dateModified", "updated_at", "updatedAt"]),
    };
  }

  private normalizeDomainOperationProcessed(payload: Record<string, unknown> | null) {
    if (!payload) {
      return {
        errors: [],
        success: [],
      };
    }

    const lookup = createLookup(payload);

    return {
      errors: this.readProcessedErrors(readLookupValue(lookup, ["errors", "failed", "failures"])),
      success: this.readProcessedSuccess(readLookupValue(lookup, ["success", "successful", "succeeded"])),
    };
  }

  private normalizeGroupList(payload: unknown, connection: PiholeConnection, path: string): PiholeGroupListResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawGroups = readLookupValue(payloadLookup, ["groups", "group", "items", "results"]);

    if (!Array.isArray(rawGroups)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      groups: rawGroups
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => this.normalizeManagedGroup(item)),
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeGroupMutation(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeGroupMutationResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawGroups = readLookupValue(payloadLookup, ["groups", "group", "items", "results"]);
    const rawProcessed = readLookupRecord(payloadLookup, ["processed", "result", "summary"]);
    const groups = Array.isArray(rawGroups)
      ? rawGroups
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => this.normalizeManagedGroup(item))
      : [];
    const processed = this.normalizeGroupOperationProcessed(rawProcessed);

    if (groups.length === 0 && processed.errors.length === 0 && processed.success.length === 0) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      groups,
      processed,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeListList(payload: unknown, connection: PiholeConnection, path: string): PiholeListListResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawLists = readLookupValue(payloadLookup, ["lists", "list", "items", "results"]);

    if (!Array.isArray(rawLists)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      lists: rawLists
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => this.normalizeManagedList(item)),
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeListMutation(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeListMutationResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawLists = readLookupValue(payloadLookup, ["lists", "list", "items", "results"]);
    const rawProcessed = readLookupRecord(payloadLookup, ["processed", "result", "summary"]);
    const lists = Array.isArray(rawLists)
      ? rawLists
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => this.normalizeManagedList(item))
      : [];
    const processed = this.normalizeGroupOperationProcessed(rawProcessed);

    if (lists.length === 0 && processed.errors.length === 0 && processed.success.length === 0) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      lists,
      processed,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeManagedList(lookupSource: Record<string, unknown>): PiholeManagedListEntry {
    const lookup = createLookup(lookupSource);

    return {
      address: readLookupString(lookup, ["address", "url"]),
      comment: readLookupString(lookup, ["comment"]),
      groups: readLookupNumberArray(lookup, ["groups"]),
      enabled: readLookupBoolean(lookup, ["enabled"]),
      id: readLookupNumber(lookup, ["id"]),
      dateAdded: readLookupNumber(lookup, ["date_added", "dateAdded", "created_at", "createdAt"]),
      dateModified: readLookupNumber(lookup, ["date_modified", "dateModified", "updated_at", "updatedAt"]),
      type: this.readListType(readLookupString(lookup, ["type"])),
      dateUpdated: readLookupNumber(lookup, ["date_updated", "dateUpdated"]),
      number: readLookupNumber(lookup, ["number"]),
      invalidDomains: readLookupNumber(lookup, ["invalid_domains", "invalidDomains"]),
      abpEntries: readLookupNumber(lookup, ["abp_entries", "abpEntries"]),
      status: readLookupNumber(lookup, ["status"]),
    };
  }

  private readListType(value: string | null): PiholeListType | null {
    if (value === "allow" || value === "block") {
      return value;
    }

    return null;
  }

  private normalizeManagedGroup(payload: Record<string, unknown>): PiholeManagedGroupEntry {
    const lookup = createLookup(payload);

    return {
      name: readLookupString(lookup, ["name", "item", "value"]),
      comment: readLookupString(lookup, ["comment", "note", "description"]),
      enabled: readBoolean(readLookupValue(lookup, ["enabled", "active"])),
      id: readLookupNumber(lookup, ["id"]),
      dateAdded: readLookupNumber(lookup, ["date_added", "dateAdded", "created_at", "createdAt"]),
      dateModified: readLookupNumber(lookup, ["date_modified", "dateModified", "updated_at", "updatedAt"]),
    };
  }

  private normalizeGroupOperationProcessed(payload: Record<string, unknown> | null) {
    if (!payload) {
      return {
        errors: [],
        success: [],
      };
    }

    const lookup = createLookup(payload);

    return {
      errors: this.readProcessedErrors(readLookupValue(lookup, ["errors", "failed", "failures"])),
      success: this.readProcessedSuccess(readLookupValue(lookup, ["success", "successful", "succeeded"])),
    };
  }

  private normalizeClientList(payload: unknown, connection: PiholeConnection, path: string): PiholeClientListResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawClients = readLookupValue(payloadLookup, ["clients", "client", "items", "results"]);

    if (!Array.isArray(rawClients)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      clients: rawClients
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => this.normalizeManagedClient(item)),
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeClientMutation(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeClientMutationResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawClients = readLookupValue(payloadLookup, ["clients", "client", "items", "results"]);
    const rawProcessed = readLookupRecord(payloadLookup, ["processed", "result", "summary"]);
    const clients = Array.isArray(rawClients)
      ? rawClients
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => this.normalizeManagedClient(item))
      : [];
    const processed = this.normalizeClientOperationProcessed(rawProcessed);

    if (clients.length === 0 && processed.errors.length === 0 && processed.success.length === 0) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      clients,
      processed,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeManagedClient(payload: Record<string, unknown>): PiholeManagedClientEntry {
    const lookup = createLookup(payload);

    return {
      client: readLookupString(lookup, ["client", "item", "value", "name"]),
      name: readLookupString(lookup, ["name", "alias", "hostname"]),
      comment: readLookupString(lookup, ["comment", "note", "description"]),
      groups: readNumericArray(readLookupValue(lookup, ["groups", "group_ids", "groupIds"])) ?? [],
      id: readLookupNumber(lookup, ["id"]),
      dateAdded: readLookupNumber(lookup, ["date_added", "dateAdded", "created_at", "createdAt"]),
      dateModified: readLookupNumber(lookup, ["date_modified", "dateModified", "updated_at", "updatedAt"]),
    };
  }

  private normalizeClientOperationProcessed(payload: Record<string, unknown> | null) {
    if (!payload) {
      return {
        errors: [],
        success: [],
      };
    }

    const lookup = createLookup(payload);

    return {
      errors: this.readProcessedErrors(readLookupValue(lookup, ["errors", "failed", "failures"])),
      success: this.readProcessedSuccess(readLookupValue(lookup, ["success", "successful", "succeeded"])),
    };
  }

  private normalizeClientSuggestions(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeClientSuggestionsResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawSuggestions = readLookupValue(payloadLookup, ["clients", "suggestions", "items", "results"]);
    const suggestions = readStringArray(rawSuggestions) ?? [];

    if (suggestions.length === 0 && !Array.isArray(rawSuggestions)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      suggestions,
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeNetworkDevices(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeNetworkDevicesResult {
    if (!isRecord(payload)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const payloadLookup = createLookup(payload);
    const rawDevices = readLookupValue(payloadLookup, ["devices", "items", "results"]);

    if (!Array.isArray(rawDevices)) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    return {
      devices: rawDevices
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => this.normalizeNetworkDevice(item)),
      took: readLookupNumber(payloadLookup, ["took", "duration", "elapsed"]),
    };
  }

  private normalizeNetworkDevice(payload: Record<string, unknown>): PiholeNetworkDevice {
    const lookup = createLookup(payload);
    const rawIps = readLookupValue(lookup, ["ips", "ip", "addresses"]);

    return {
      id: readLookupNumber(lookup, ["id"]),
      hwaddr: readLookupString(lookup, ["hwaddr", "mac", "mac_address", "macAddress"]),
      interface: readLookupString(lookup, ["interface", "iface"]),
      firstSeen: readLookupNumber(lookup, ["first_seen", "firstSeen", "created_at", "createdAt"]),
      lastQuery: readLookupNumber(lookup, ["last_query", "lastQuery", "queried_at", "queriedAt"]),
      numQueries: readLookupNumber(lookup, ["num_queries", "numQueries", "queries"]),
      macVendor: readLookupString(lookup, ["mac_vendor", "macVendor", "vendor"]),
      ips: Array.isArray(rawIps)
        ? rawIps
            .filter((item): item is Record<string, unknown> => isRecord(item))
            .map((item) => this.normalizeNetworkDeviceAddress(item))
        : [],
    };
  }

  private normalizeNetworkDeviceAddress(payload: Record<string, unknown>): PiholeNetworkDeviceAddress {
    const lookup = createLookup(payload);

    return {
      ip: readLookupString(lookup, ["ip", "address"]),
      name: readLookupString(lookup, ["name", "hostname", "alias"]),
      lastSeen: readLookupNumber(lookup, ["last_seen", "lastSeen"]),
      nameUpdated: readLookupNumber(lookup, ["name_updated", "nameUpdated"]),
    };
  }

  private readProcessedErrors(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => {
      if (isRecord(item)) {
        return {
          item: readFirstString(item, ["item", "domain", "value", "name", "client"]),
          message: readFirstString(item, ["message", "error", "description", "detail"]),
        };
      }

      if (typeof item === "string") {
        return {
          item: null,
          message: readString(item),
        };
      }

      return {
        item: null,
        message: null,
      };
    });
  }

  private readProcessedSuccess(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => {
      if (isRecord(item)) {
        return {
          item: readFirstString(item, ["item", "domain", "value", "name", "client"]),
        };
      }

      if (typeof item === "string") {
        return {
          item: readString(item),
        };
      }

      return {
        item: null,
      };
    });
  }

  private readSuggestionValues(lookup: NormalizedLookup, key: (typeof PIHOLE_QUERY_SUGGESTION_KEYS)[number]) {
    switch (key) {
      case "domain":
        return readStringArray(readLookupValue(lookup, ["domain", "domains"])) ?? [];
      case "client_ip":
        return readStringArray(readLookupValue(lookup, ["client_ip", "clientip", "clientips", "client_ips"])) ?? [];
      case "client_name":
        return (
          readStringArray(readLookupValue(lookup, ["client_name", "clientname", "client_names", "clientnames"])) ?? []
        );
      case "upstream":
        return readStringArray(readLookupValue(lookup, ["upstream", "upstreams"])) ?? [];
      case "type":
        return readStringArray(readLookupValue(lookup, ["type", "types", "query_type", "query_types"])) ?? [];
      case "status":
        return readStringArray(readLookupValue(lookup, ["status", "statuses", "query_status", "query_statuses"])) ?? [];
      case "reply":
        return readStringArray(readLookupValue(lookup, ["reply", "replies", "reply_type", "reply_types"])) ?? [];
      case "dnssec":
        return (
          readStringArray(readLookupValue(lookup, ["dnssec", "dnssecs", "dnssec_status", "dnssec_statuses"])) ?? []
        );
      default:
        return [];
    }
  }

  private normalizeHistoryPoints(payload: unknown, connection: PiholeConnection, path: string): PiholeHistoryPoint[] {
    const entries = this.getHistoryEntries(payload);

    if (entries.length === 0) {
      throw this.createInvalidResponseError(connection, path, payload);
    }

    const points = entries.map((entry) => {
      const timestamp = readFirstNumber(entry, ["timestamp", "time", "ts"]);
      const totalQueries = readFirstNumber(entry, ["total", "queries", "dns_queries", "total_queries"]);
      const cachedQueries = readFirstNumber(entry, ["cached", "cache_hits", "cached_queries"]) ?? 0;
      const blockedQueries =
        readFirstNumber(entry, ["blocked", "ads", "blocked_queries", "ads_blocked", "queries_blocked"]) ?? 0;
      const forwardedQueries = readFirstNumber(entry, ["forwarded", "upstream", "forwarded_queries"]) ?? 0;

      if (timestamp === null || totalQueries === null) {
        throw this.createInvalidResponseError(connection, path, payload);
      }

      return {
        timestamp,
        totalQueries,
        cachedQueries,
        blockedQueries,
        forwardedQueries,
      };
    });

    return points.sort((left, right) => left.timestamp - right.timestamp);
  }

  private normalizeClientActivity(
    payload: unknown,
    connection: PiholeConnection,
    path: string,
  ): PiholeClientActivitySeries[] {
    const fromTimestampEntries = this.normalizeClientActivityFromTimestampEntries(payload);

    if (fromTimestampEntries) {
      return fromTimestampEntries;
    }

    const fromSeriesEntries = this.normalizeClientActivityFromSeriesEntries(payload);

    if (fromSeriesEntries) {
      return fromSeriesEntries;
    }

    throw this.createInvalidResponseError(connection, path, payload);
  }

  private normalizeClientActivityFromTimestampEntries(payload: unknown): PiholeClientActivitySeries[] | null {
    const entries = this.getClientHistoryEntries(payload);

    if (entries.length === 0) {
      return null;
    }

    const series = new Map<string, ClientSeriesAccumulator>();
    let hasClientValues = false;

    for (const entry of entries) {
      for (const [label, queries] of Object.entries(entry.data)) {
        hasClientValues = true;
        this.addClientQueries(series, label, entry.timestamp, queries);
      }
    }

    if (!hasClientValues) {
      return null;
    }

    return this.buildClientActivitySeries(series);
  }

  private normalizeClientActivityFromSeriesEntries(payload: unknown): PiholeClientActivitySeries[] | null {
    if (!isRecord(payload)) {
      return null;
    }

    const timestamps =
      readNumericArray(payload.timestamps) ??
      readNumericArray(payload.time) ??
      readNumericArray(payload.timeline) ??
      readNumericArray(payload.history);
    const series = new Map<string, ClientSeriesAccumulator>();
    const rawSeries = payload.clients ?? payload.series;

    if (Array.isArray(rawSeries)) {
      for (const item of rawSeries) {
        if (!isRecord(item)) {
          continue;
        }

        const label = readFirstString(item, ["name", "client", "label", "id"]);

        if (!label) {
          continue;
        }

        if (Array.isArray(item.points)) {
          for (const point of item.points) {
            if (!isRecord(point)) {
              continue;
            }

            const timestamp = readFirstNumber(point, ["timestamp", "time", "ts"]);
            const queries = readFirstNumber(point, ["queries", "total", "count", "value"]);

            if (timestamp === null || queries === null) {
              continue;
            }

            this.addClientQueries(series, label, timestamp, queries);
          }

          continue;
        }

        if (!timestamps) {
          continue;
        }

        const values =
          readNumericArray(item.data) ??
          readNumericArray(item.history) ??
          readNumericArray(item.queries) ??
          readNumericArray(item.counts);

        if (!values) {
          continue;
        }

        for (let index = 0; index < Math.min(timestamps.length, values.length); index += 1) {
          this.addClientQueries(series, label, timestamps[index] ?? 0, values[index] ?? 0);
        }
      }
    } else if (isRecord(rawSeries) && timestamps) {
      for (const [label, rawValues] of Object.entries(rawSeries)) {
        const values = readNumericArray(rawValues);

        if (!values) {
          continue;
        }

        for (let index = 0; index < Math.min(timestamps.length, values.length); index += 1) {
          this.addClientQueries(series, label, timestamps[index] ?? 0, values[index] ?? 0);
        }
      }
    }

    return series.size > 0 ? this.buildClientActivitySeries(series) : null;
  }

  private addClientQueries(
    series: Map<string, ClientSeriesAccumulator>,
    label: string,
    timestamp: number,
    queries: number,
  ) {
    const normalizedLabel = label.trim();

    if (normalizedLabel.length === 0) {
      return;
    }

    const current = series.get(normalizedLabel) ?? {
      label: normalizedLabel,
      totalQueries: 0,
      points: new Map<number, number>(),
    };

    current.totalQueries += queries;
    current.points.set(timestamp, (current.points.get(timestamp) ?? 0) + queries);
    series.set(normalizedLabel, current);
  }

  private buildClientActivitySeries(series: Map<string, ClientSeriesAccumulator>): PiholeClientActivitySeries[] {
    return Array.from(series.values())
      .map((item) => ({
        key: normalizeClientSeriesKey(item.label),
        label: item.label,
        totalQueries: item.totalQueries,
        points: Array.from(item.points.entries())
          .map(([timestamp, queries]) => ({
            timestamp,
            queries,
          }))
          .sort((left, right) => left.timestamp - right.timestamp),
      }))
      .sort((left, right) => right.totalQueries - left.totalQueries || left.label.localeCompare(right.label));
  }

  private getHistoryEntries(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload.filter(isRecord);
    }

    if (isRecord(payload) && Array.isArray(payload.history)) {
      return payload.history.filter(isRecord);
    }

    return [];
  }

  private createInvalidResponseError(connection: PiholeConnection, path: string, payload: unknown) {
    this.logger.warn(`Pi-hole returned an unexpected payload for ${connection.baseUrl}/api${path}.`);

    return new PiholeRequestError(
      502,
      translateApi(connection.locale ?? DEFAULT_API_LOCALE, "pihole.invalidResponse", {
        baseUrl: connection.baseUrl,
        path,
      }),
      "pihole_response_error",
      payload,
    );
  }

  private extractVersionSummary(payload: unknown, locale = DEFAULT_API_LOCALE) {
    if (typeof payload === "object" && payload !== null) {
      const maybeVersion = payload as Record<string, unknown>;

      if (typeof maybeVersion.version === "string") {
        return maybeVersion.version;
      }

      if (typeof maybeVersion.ftl === "string") {
        return maybeVersion.ftl;
      }

      if (typeof maybeVersion.core === "string" && typeof maybeVersion.web === "string") {
        return `${maybeVersion.core} / ${maybeVersion.web}`;
      }
    }

    return translateApi(locale, "pihole.reachable");
  }

  private normalizeBaseUrl(baseUrl: string) {
    const trimmedBaseUrl = baseUrl.trim();
    const normalizedScheme = trimmedBaseUrl.replace(/^([a-z][a-z0-9+.-]*:)\/*/i, "$1//");
    const parsed = new URL(normalizedScheme);
    const normalizedPath = parsed.pathname.replaceAll(/\/{2,}/g, "/");

    parsed.pathname = normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
    parsed.search = "";
    parsed.hash = "";

    return parsed.toString();
  }

  private getClientHistoryEntries(payload: unknown): PiholeClientHistoryBucket[] {
    if (!isRecord(payload) || !Array.isArray(payload.history)) {
      return [];
    }

    const entries: PiholeClientHistoryBucket[] = [];

    for (const rawEntry of payload.history) {
      if (!isRecord(rawEntry)) {
        return [];
      }

      const timestamp = readNumber(rawEntry.timestamp);
      const rawData = rawEntry.data;

      if (timestamp === null || !isRecord(rawData)) {
        return [];
      }

      const data: Record<string, number> = {};

      for (const [label, rawQueries] of Object.entries(rawData)) {
        const queries = readNumber(rawQueries);

        if (queries === null) {
          return [];
        }

        data[label] = queries;
      }

      entries.push({
        timestamp,
        data,
      });
    }

    return entries;
  }

  private normalizeAuthSessions(payload: unknown, connection: PiholeConnection): PiholeAuthSessionRecord[] {
    if (!isRecord(payload) || !Array.isArray(payload.sessions)) {
      throw this.createInvalidResponseError(connection, "/auth/sessions", payload);
    }

    const sessions: PiholeAuthSessionRecord[] = [];

    for (const rawSession of payload.sessions) {
      if (!isRecord(rawSession)) {
        throw this.createInvalidResponseError(connection, "/auth/sessions", payload);
      }

      const tlsRecord = isRecord(rawSession.tls) ? rawSession.tls : null;
      const id = readNumber(rawSession.id);
      const currentSession = readBoolean(rawSession.current_session);
      const valid = readBoolean(rawSession.valid);
      const loginAt = readNumber(rawSession.login_at);
      const lastActive = readNumber(rawSession.last_active);
      const validUntil = readNumber(rawSession.valid_until);
      const app = readBoolean(rawSession.app);
      const cli = readBoolean(rawSession.cli);
      const tlsLogin = tlsRecord ? readBoolean(tlsRecord.login) : null;
      const tlsMixed = tlsRecord ? readBoolean(tlsRecord.mixed) : null;

      if (
        id === null ||
        currentSession === null ||
        valid === null ||
        loginAt === null ||
        lastActive === null ||
        validUntil === null ||
        app === null ||
        cli === null ||
        tlsLogin === null ||
        tlsMixed === null
      ) {
        throw this.createInvalidResponseError(connection, "/auth/sessions", payload);
      }

      sessions.push({
        id,
        currentSession,
        valid,
        tls: {
          login: tlsLogin,
          mixed: tlsMixed,
        },
        loginAt,
        lastActive,
        validUntil,
        remoteAddr: readString(rawSession.remote_addr),
        userAgent: readString(rawSession.user_agent),
        xForwardedFor: rawSession.x_forwarded_for === null ? null : readString(rawSession.x_forwarded_for),
        app,
        cli,
      });
    }

    return sessions;
  }
}
