import type { Request } from "express";

import type {
  PiholeManagedInstanceSummary,
  PiholeQueryListRequest,
  PiholeQueryListResult,
  PiholeQueryLogEntry,
  PiholeQuerySuggestionsResult,
} from "../pihole/pihole.types";
import { QueriesService } from "./queries.service";
import type { QueryGroupMembershipRefreshResponse, QueryGroupOption } from "./queries.types";
import assert from "node:assert/strict";
import test from "node:test";

const REQUEST = { headers: {} } as Request;

type InstanceSeed = {
  suggestions?: PiholeQuerySuggestionsResult;
  queryPages?: Record<number, PiholeQueryListResult>;
  queryError?: Error;
  suggestionError?: Error;
};

type ClientDeviceAliasSeed = {
  alias: string | null;
  ips: string[];
};

type GroupMembershipSeed = {
  allowedIpsByInstance?: Map<string, Set<string>>;
  groupOptions?: QueryGroupOption[];
  refreshResponse?: QueryGroupMembershipRefreshResponse;
};

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createInstance(id: string, name: string): PiholeManagedInstanceSummary {
  return {
    id,
    name,
    baseUrl: `https://${id}.example.test`,
  };
}

function createQueryEntry(
  id: number,
  time: number,
  ip: string,
  domain: string,
  overrides: Partial<PiholeQueryLogEntry> = {},
): PiholeQueryLogEntry {
  return {
    id,
    time,
    type: overrides.type ?? "A",
    status: overrides.status ?? "FORWARDED",
    dnssec: overrides.dnssec ?? "UNKNOWN",
    domain,
    upstream: overrides.upstream ?? "dns.google#53",
    reply: overrides.reply ?? {
      type: "IP",
      time: 12,
    },
    client: overrides.client ?? {
      ip,
      name: null,
    },
    listId: overrides.listId ?? null,
    ede: overrides.ede ?? null,
    cname: overrides.cname ?? null,
  };
}

function createQueryResult(
  queries: PiholeQueryLogEntry[],
  overrides: Partial<Omit<PiholeQueryListResult, "queries">> = {},
): PiholeQueryListResult {
  return {
    queries,
    cursor: overrides.cursor ?? null,
    recordsTotal: overrides.recordsTotal ?? queries.length,
    recordsFiltered: overrides.recordsFiltered ?? queries.length,
    earliestTimestamp:
      overrides.earliestTimestamp ?? (queries.length > 0 ? Math.min(...queries.map((query) => query.time)) : null),
    earliestTimestampDisk: overrides.earliestTimestampDisk ?? null,
    took: overrides.took ?? 0,
  };
}

function createSuggestions(
  overrides: Partial<PiholeQuerySuggestionsResult["suggestions"]> = {},
): PiholeQuerySuggestionsResult {
  return {
    suggestions: {
      domain: overrides.domain ?? [],
      client_ip: overrides.client_ip ?? [],
      client_name: overrides.client_name ?? [],
      upstream: overrides.upstream ?? [],
      type: overrides.type ?? [],
      status: overrides.status ?? [],
      reply: overrides.reply ?? [],
      dnssec: overrides.dnssec ?? [],
    },
    took: 0,
  };
}

function cloneAllowedIpsByInstance(source: Map<string, Set<string>>) {
  return new Map<string, Set<string>>(
    [...source.entries()].map(([instanceId, ips]) => [instanceId, new Set([...ips])]),
  );
}

function createService(
  instances: PiholeManagedInstanceSummary[],
  seed: Record<string, InstanceSeed>,
  options: {
    clientDevices?: ClientDeviceAliasSeed[];
    groupMemberships?: GroupMembershipSeed;
  } = {},
) {
  const calls = {
    getQueries: [] as Array<{ instanceId: string; filters: PiholeQueryListRequest }>,
    getQuerySuggestions: [] as string[],
    listGroups: [] as string[],
    listClients: [] as string[],
    listNetworkDevices: [] as string[],
    listGroupOptions: 0,
    loadAllowedIpsByInstance: [] as Array<{ groupIds: number[]; instanceIds: string[] }>,
    refreshGroupMemberships: 0,
  };
  const clientDevices = options.clientDevices ?? [];
  const groupMemberships = options.groupMemberships ?? {};
  const refreshResponse: QueryGroupMembershipRefreshResponse = groupMemberships.refreshResponse ?? {
    updatedAt: "2026-04-14T12:00:00.000Z",
    summary: {
      totalInstances: instances.length,
      refreshedInstances: instances.length,
      failedInstances: 0,
      groupsCached: groupMemberships.groupOptions?.length ?? 0,
      membershipsCached: 0,
      instancesNeedingReview: 0,
    },
    requiresGroupReview: false,
    reviewPath: "/groups",
    failedInstances: [],
  };

  const prisma = {
    clientDevice: {
      findMany: async ({
        where,
      }: {
        where?: {
          alias?: { not: null };
          ips?: {
            hasSome?: string[];
          };
        };
      } = {}) => {
        const requestedIps = new Set(where?.ips?.hasSome ?? []);

        return clientDevices
          .filter((device) => {
            if (where?.alias?.not === null) {
              return true;
            }

            if (device.alias === null) {
              return false;
            }

            if (requestedIps.size === 0) {
              return true;
            }

            return device.ips.some((ip) => requestedIps.has(ip));
          })
          .map((device) => cloneValue(device));
      },
    },
  };

  const instanceSessions = {
    listInstanceSummaries: async () => cloneValue(instances),
    getInstanceSummary: async (instanceId: string) => {
      const instance = instances.find((item) => item.id === instanceId);

      if (!instance) {
        throw new Error(`Missing instance ${instanceId}`);
      }

      return cloneValue(instance);
    },
    withActiveSession: async (
      instanceId: string,
      _locale: unknown,
      callback: (context: { connection: { instanceId: string }; session: { instanceId: string } }) => Promise<unknown>,
    ) => callback({ connection: { instanceId }, session: { instanceId } }),
  };

  const pihole = {
    listGroups: async (_connection: unknown, session: { instanceId: string }) => {
      calls.listGroups.push(session.instanceId);
      return { groups: [], took: 0 };
    },
    listClients: async (_connection: unknown, session: { instanceId: string }) => {
      calls.listClients.push(session.instanceId);
      return { clients: [], took: 0 };
    },
    listNetworkDevices: async (_connection: unknown, session: { instanceId: string }) => {
      calls.listNetworkDevices.push(session.instanceId);
      return { devices: [], took: 0 };
    },
    getQuerySuggestions: async (_connection: unknown, session: { instanceId: string }) => {
      calls.getQuerySuggestions.push(session.instanceId);
      const config = seed[session.instanceId];

      if (config?.suggestionError) {
        throw config.suggestionError;
      }

      return cloneValue(config?.suggestions ?? createSuggestions());
    },
    getQueries: async (_connection: unknown, session: { instanceId: string }, filters: PiholeQueryListRequest) => {
      calls.getQueries.push({
        instanceId: session.instanceId,
        filters: cloneValue(filters),
      });
      const config = seed[session.instanceId];

      if (config?.queryError) {
        throw config.queryError;
      }

      return cloneValue(config?.queryPages?.[filters.start ?? 0] ?? createQueryResult([]));
    },
  };

  const queryGroupMemberships = {
    listGroupOptions: async () => {
      calls.listGroupOptions += 1;
      return cloneValue(groupMemberships.groupOptions ?? []);
    },
    loadAllowedIpsByInstance: async (groupIds: number[], instanceIds: string[]) => {
      calls.loadAllowedIpsByInstance.push({
        groupIds: [...groupIds],
        instanceIds: [...instanceIds],
      });

      return cloneAllowedIpsByInstance(groupMemberships.allowedIpsByInstance ?? new Map());
    },
    refreshGroupMemberships: async () => {
      calls.refreshGroupMemberships += 1;
      return cloneValue(refreshResponse);
    },
  };

  return {
    service: new QueriesService(
      prisma as never,
      instanceSessions as never,
      pihole as never,
      queryGroupMemberships as never,
    ),
    calls,
  };
}

test("keeps the native query flow when groupIds are absent", async () => {
  const instance = createInstance("alpha", "Alpha");
  const { service, calls } = createService(
    [instance],
    {
      [instance.id]: {
        queryPages: {
          0: createQueryResult([createQueryEntry(101, 1_775_000_100, "192.168.1.10", "alpha.example")]),
        },
      },
    },
    {
      clientDevices: [
        {
          alias: "Notebook",
          ips: ["192.168.1.10"],
        },
      ],
    },
  );

  const response = await service.getQueries(
    {
      scope: "instance",
      instanceId: instance.id,
      length: 10,
      start: 0,
    },
    REQUEST,
  );

  assert.equal(response.queries.length, 1);
  assert.equal(response.queries[0]?.client?.alias, "Notebook");
  assert.equal(calls.getQueries.length, 1);
  assert.equal(calls.getQueries[0]?.filters.length, 10);
  assert.equal(calls.loadAllowedIpsByInstance.length, 0);
  assert.equal(calls.listGroups.length, 0);
  assert.equal(calls.listClients.length, 0);
  assert.equal(calls.listNetworkDevices.length, 0);
});

test("filters queries locally by cached group IP memberships when groupIds are present", async () => {
  const instance = createInstance("alpha", "Alpha");
  const { service, calls } = createService(
    [instance],
    {
      [instance.id]: {
        queryPages: {
          0: createQueryResult(
            [
              createQueryEntry(101, 1_775_000_100, "192.168.1.10", "allowed.example"),
              createQueryEntry(102, 1_775_000_090, "192.168.1.20", "blocked.example"),
            ],
            {
              recordsTotal: 2,
              recordsFiltered: 2,
            },
          ),
        },
      },
    },
    {
      clientDevices: [
        {
          alias: "Notebook",
          ips: ["192.168.1.10"],
        },
      ],
      groupMemberships: {
        allowedIpsByInstance: new Map([[instance.id, new Set(["192.168.1.10"])]]),
      },
    },
  );

  const response = await service.getQueries(
    {
      scope: "instance",
      instanceId: instance.id,
      groupIds: [11],
      length: 10,
      start: 0,
    },
    REQUEST,
  );

  assert.deepEqual(calls.loadAllowedIpsByInstance, [
    {
      groupIds: [11],
      instanceIds: [instance.id],
    },
  ]);
  assert.equal(calls.getQueries.length, 1);
  assert.equal(calls.getQueries[0]?.filters.length, 200);
  assert.equal(calls.getQueries[0]?.filters.start, 0);
  assert.equal(calls.getQueries[0]?.filters.clientIp, undefined);
  assert.equal(response.recordsTotal, 2);
  assert.equal(response.recordsFiltered, 1);
  assert.equal(response.queries.length, 1);
  assert.equal(response.queries[0]?.domain, "allowed.example");
  assert.equal(response.queries[0]?.client?.alias, "Notebook");
});

test("ignores cached group filtering when a native client_ip filter is present", async () => {
  const instance = createInstance("alpha", "Alpha");
  const { service, calls } = createService([instance], {
    [instance.id]: {
      queryPages: {
        0: createQueryResult([createQueryEntry(101, 1_775_000_100, "192.168.1.10", "alpha.example")]),
      },
    },
  });

  const response = await service.getQueries(
    {
      scope: "instance",
      instanceId: instance.id,
      groupIds: [11],
      client_ip: "192.168.1.10",
      length: 10,
      start: 0,
    },
    REQUEST,
  );

  assert.equal(response.queries.length, 1);
  assert.equal(calls.loadAllowedIpsByInstance.length, 0);
  assert.equal(calls.getQueries.length, 1);
  assert.equal(calls.getQueries[0]?.filters.clientIp, "192.168.1.10");
});

test("builds filtered suggestions from cached memberships and still returns groupOptions", async () => {
  const instance = createInstance("alpha", "Alpha");
  const groupOptions = [
    { id: 3, name: "Guests" },
    { id: 11, name: "teste_2" },
  ] satisfies QueryGroupOption[];
  const { service, calls } = createService(
    [instance],
    {
      [instance.id]: {
        queryPages: {
          0: createQueryResult(
            [
              createQueryEntry(101, 1_775_000_100, "192.168.1.10", "allowed.example", {
                client: {
                  ip: "192.168.1.10",
                  name: "Laptop",
                },
              }),
              createQueryEntry(102, 1_775_000_090, "192.168.1.20", "blocked.example", {
                client: {
                  ip: "192.168.1.20",
                  name: "TV",
                },
              }),
            ],
            {
              recordsTotal: 2,
              recordsFiltered: 2,
            },
          ),
        },
      },
    },
    {
      groupMemberships: {
        groupOptions,
        allowedIpsByInstance: new Map([[instance.id, new Set(["192.168.1.10"])]]),
      },
    },
  );

  const response = await service.getQuerySuggestions(
    {
      scope: "instance",
      instanceId: instance.id,
      groupIds: [11],
    },
    REQUEST,
  );

  assert.deepEqual(response.groupOptions, groupOptions);
  assert.deepEqual(response.suggestions.domain, ["allowed.example"]);
  assert.deepEqual(response.suggestions.client_ip, ["192.168.1.10"]);
  assert.deepEqual(response.suggestions.client_name, ["Laptop"]);
  assert.equal(calls.listGroupOptions, 1);
  assert.equal(calls.loadAllowedIpsByInstance.length, 1);
  assert.equal(calls.getQuerySuggestions.length, 0);
  assert.equal(calls.getQueries.length, 1);
});

test("normalizes scalar groupIds from query strings before filtering suggestions", async () => {
  const instance = createInstance("alpha", "Alpha");
  const { service, calls } = createService(
    [instance],
    {
      [instance.id]: {
        queryPages: {
          0: createQueryResult([createQueryEntry(101, 1_775_000_100, "192.168.1.10", "allowed.example")]),
        },
      },
    },
    {
      groupMemberships: {
        allowedIpsByInstance: new Map([[instance.id, new Set(["192.168.1.10"])]]),
      },
    },
  );

  const response = await service.getQuerySuggestions(
    {
      scope: "instance",
      instanceId: instance.id,
      groupIds: "11" as never,
    },
    REQUEST,
  );

  assert.deepEqual(calls.loadAllowedIpsByInstance, [
    {
      groupIds: [11],
      instanceIds: [instance.id],
    },
  ]);
  assert.deepEqual(response.suggestions.domain, ["allowed.example"]);
});

test("merges native Pi-hole suggestions and attaches cached group options when no group filter is active", async () => {
  const alpha = createInstance("alpha", "Alpha");
  const beta = createInstance("beta", "Beta");
  const groupOptions = [
    { id: 3, name: "Guests" },
    { id: 11, name: "teste_2" },
  ] satisfies QueryGroupOption[];
  const { service, calls } = createService(
    [alpha, beta],
    {
      [alpha.id]: {
        suggestions: createSuggestions({
          domain: ["alpha.example", "shared.example"],
          client_ip: ["192.168.1.10"],
          status: ["FORWARDED"],
        }),
      },
      [beta.id]: {
        suggestions: createSuggestions({
          domain: ["beta.example", "shared.example"],
          client_ip: ["192.168.1.11"],
          status: ["BLOCKED"],
        }),
      },
    },
    {
      groupMemberships: {
        groupOptions,
      },
    },
  );

  const response = await service.getQuerySuggestions(
    {
      scope: "all",
    },
    REQUEST,
  );

  assert.deepEqual(response.groupOptions, groupOptions);
  assert.deepEqual(response.suggestions.domain, ["alpha.example", "beta.example", "shared.example"]);
  assert.deepEqual(response.suggestions.client_ip, ["192.168.1.10", "192.168.1.11"]);
  assert.deepEqual(response.suggestions.status, ["BLOCKED", "FORWARDED"]);
  assert.deepEqual(calls.getQuerySuggestions, [alpha.id, beta.id]);
  assert.equal(calls.loadAllowedIpsByInstance.length, 0);
});

test("delegates group membership refresh to the cache service", async () => {
  const instance = createInstance("alpha", "Alpha");
  const refreshResponse: QueryGroupMembershipRefreshResponse = {
    updatedAt: "2026-04-14T12:00:00.000Z",
    summary: {
      totalInstances: 1,
      refreshedInstances: 1,
      failedInstances: 0,
      groupsCached: 2,
      membershipsCached: 3,
      instancesNeedingReview: 0,
    },
    requiresGroupReview: false,
    reviewPath: "/groups",
    failedInstances: [],
  };
  const { service, calls } = createService(
    [instance],
    {},
    {
      groupMemberships: {
        refreshResponse,
      },
    },
  );

  const response = await service.refreshGroupMemberships(REQUEST);

  assert.deepEqual(response, refreshResponse);
  assert.equal(calls.refreshGroupMemberships, 1);
});
