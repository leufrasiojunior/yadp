import "reflect-metadata";

import type { Request } from "express";

import type { SubnetPlanDto } from "./dto/subnet-plan.dto";
import { normalizeSubnet } from "./subnet-validation";
import { SubnetsService } from "./subnets.service";
import assert from "node:assert/strict";
import test from "node:test";

const REQUEST = { headers: {} } as Request;
const CLIENT = "192.0.2.0/24";
const DTO: SubnetPlanDto = { client: CLIENT, operation: "save", groups: ["IoT"], comment: "IoT policy" };

function fixture() {
  const nodes = ["one", "two"].map((id) => ({ id, name: id, baseUrl: `https://${id}.example.test` }));
  const clients = new Map(
    nodes.map((node) => [node.id, new Map<string, { client: string; groups: number[]; comment: string }>()]),
  );
  const groups = new Map([
    [
      "one",
      [
        { id: 0, name: "Default" },
        { id: 2, name: "IoT" },
      ],
    ],
    [
      "two",
      [
        { id: 0, name: "Default" },
        { id: 9, name: "IoT" },
      ],
    ],
  ]);
  const writes: { node: string; method: string; client: string; groups?: number[] }[] = [];
  const offline = new Set<string>();
  const failWrite = new Set<string>();
  const rejectWrite = new Set<string>();
  const ignoreWrite = new Set<string>();
  const audits: unknown[] = [];
  const pihole = {
    listClients: async (connection: { baseUrl: string }) => ({
      clients: [...clients.get(connection.baseUrl)!.values()],
    }),
    listGroups: async (connection: { baseUrl: string }) => ({ groups: groups.get(connection.baseUrl)! }),
    createClients: async (
      connection: { baseUrl: string },
      _session: unknown,
      config: { clients: string[]; groups: number[]; comment: string },
    ) => {
      const node = connection.baseUrl;
      writes.push({ node, method: "create", client: config.clients[0]!, groups: config.groups });
      if (failWrite.has(node)) throw new Error("write failed");
      if (!ignoreWrite.has(node) && !rejectWrite.has(node))
        clients
          .get(node)!
          .set(config.clients[0]!, { client: config.clients[0]!, groups: config.groups, comment: config.comment });
      return { processed: { errors: rejectWrite.has(node) ? [{ message: "rejected" }] : [] } };
    },
    updateClient: async (
      connection: { baseUrl: string },
      _session: unknown,
      client: string,
      config: { groups: number[]; comment: string },
    ) => {
      writes.push({ node: connection.baseUrl, method: "update", client, groups: config.groups });
      clients.get(connection.baseUrl)!.set(client, { client, ...config });
      return { processed: { errors: [] } };
    },
    deleteClient: async (connection: { baseUrl: string }, _session: unknown, client: string) => {
      writes.push({ node: connection.baseUrl, method: "delete", client });
      clients.get(connection.baseUrl)!.delete(client);
    },
  };
  const sessions = {
    withActiveSession: async (id: string, _locale: unknown, callback: (context: unknown) => Promise<unknown>) => {
      if (offline.has(id)) throw new Error("instance offline");
      return callback({ connection: { baseUrl: id }, session: {} });
    },
  };
  const service = new SubnetsService(
    {
      record: async (value: unknown) => {
        audits.push(value);
      },
    } as never,
    sessions as never,
    pihole as never,
    { instance: { findMany: async () => nodes } } as never,
  );
  return { service, clients, groups, writes, offline, failWrite, rejectWrite, ignoreWrite, audits };
}

test("CIDR validation supports canonical IPv4/IPv6, boundaries and mapped IPv6", () => {
  for (const cidr of ["0.0.0.0/0", "192.0.2.7/32", "192.0.2.0/24", "::/0", "2001:db8::/64", "2001:db8::1/128"])
    assert.equal(normalizeSubnet(cidr), cidr);
  assert.equal(normalizeSubnet("2001:0DB8:0000:0000::/64"), "2001:db8::/64");
  assert.equal(normalizeSubnet("::ffff:192.0.2.0/120"), "::ffff:c000:200/120");
  for (const invalid of [
    "192.0.2.1/24",
    "2001:db8::1/64",
    "192.0.2.0/33",
    "::/129",
    "::/064",
    "192.0.2.0",
    "example.test/24",
    "fe80::%eth0/64",
    "::/64/0",
  ])
    assert.throws(() => normalizeSubnet(invalid), invalid);
});

test("preview is read-only and application maps groups by name, verifies and audits", async () => {
  const f = fixture();
  const preview = await f.service.preview(DTO, REQUEST);
  assert.deepEqual(
    preview.targets.map((target) => target.action),
    ["create", "create"],
  );
  assert.equal(f.writes.length, 0);
  const response = await f.service.apply({ ...DTO, previewToken: preview.previewToken }, REQUEST);
  assert.equal(response.status, "success");
  assert.deepEqual(
    f.writes.map((write) => write.groups),
    [[2], [9]],
  );
  assert.equal(f.audits.length, 1);
  const unchanged = await f.service.preview(DTO, REQUEST);
  await f.service.apply({ ...DTO, previewToken: unchanged.previewToken }, REQUEST);
  assert.equal(f.writes.length, 2, "reapplying converged state must not write");
});

test("listing shows subnet policy drift and retains unrelated MAC/IP entries", async () => {
  const f = fixture();
  f.clients.get("one")!.set(CLIENT, { client: CLIENT, groups: [2], comment: "one" });
  f.clients.get("two")!.set(CLIENT, { client: CLIENT, groups: [0], comment: "two" });
  f.clients.get("one")!.set("02:00:00:00:00:01", { client: "02:00:00:00:00:01", groups: [0], comment: "manual" });
  const listed = await f.service.list(REQUEST);
  assert.equal(listed.items.length, 1);
  assert.deepEqual(
    listed.items[0]!.instances.map((instance) => instance.groups),
    [["IoT"], ["Default"]],
  );
  const preview = await f.service.preview(DTO, REQUEST);
  await f.service.apply({ ...DTO, previewToken: preview.previewToken }, REQUEST);
  assert.equal(f.clients.get("one")!.get("02:00:00:00:00:01")!.comment, "manual");
});

test("changed policy or group IDs invalidate the reviewed plan without any writes", async () => {
  const f = fixture();
  const preview = await f.service.preview(DTO, REQUEST);
  f.clients.get("one")!.set(CLIENT, { client: CLIENT, groups: [0], comment: "changed elsewhere" });
  await assert.rejects(
    f.service.apply({ ...DTO, previewToken: preview.previewToken }, REQUEST),
    /Configuration changed/,
  );
  assert.equal(f.writes.length, 0);
  const second = await f.service.preview(DTO, REQUEST);
  f.groups.get("two")![1]!.id = 42;
  await assert.rejects(
    f.service.apply({ ...DTO, previewToken: second.previewToken }, REQUEST),
    /Configuration changed/,
  );
  assert.equal(f.writes.length, 0);
});

test("partial write failure can be retried without recreating successful replicas", async () => {
  const f = fixture();
  f.failWrite.add("two");
  const first = await f.service.preview(DTO, REQUEST);
  const response = await f.service.apply({ ...DTO, previewToken: first.previewToken }, REQUEST);
  assert.equal(response.status, "partial");
  assert.equal(response.failedInstances[0]!.instanceId, "two");
  f.failWrite.clear();
  const second = await f.service.preview(DTO, REQUEST);
  assert.deepEqual(
    second.targets.map((target) => target.action),
    ["unchanged", "create"],
  );
  assert.equal((await f.service.apply({ ...DTO, previewToken: second.previewToken }, REQUEST)).status, "success");
  assert.equal(f.writes.filter((write) => write.node === "one").length, 1);
});

test("offline replicas remain visible as failures and reconnect through a fresh preview", async () => {
  const f = fixture();
  f.offline.add("two");
  assert.equal((await f.service.list(REQUEST)).unavailableInstances.length, 1);
  const preview = await f.service.preview(DTO, REQUEST);
  assert.equal(preview.targets[1]!.action, "unavailable");
  assert.equal((await f.service.apply({ ...DTO, previewToken: preview.previewToken }, REQUEST)).status, "partial");
  f.offline.clear();
  const retry = await f.service.preview(DTO, REQUEST);
  assert.equal((await f.service.apply({ ...DTO, previewToken: retry.previewToken }, REQUEST)).status, "success");
});

test("missing groups and rejected or unverified writes never report success", async () => {
  for (const failure of ["missing", "rejected", "unverified"]) {
    const f = fixture();
    if (failure === "missing") f.groups.get("two")!.pop();
    if (failure === "rejected") f.rejectWrite.add("two");
    if (failure === "unverified") f.ignoreWrite.add("two");
    const preview = await f.service.preview(DTO, REQUEST);
    const response = await f.service.apply({ ...DTO, previewToken: preview.previewToken }, REQUEST);
    assert.equal(response.failedInstances.length, 1, failure);
    assert.equal(response.failedInstances[0]!.instanceId, "two");
  }
});

test("IPv6 updates preserve the original stored spelling and deletion is idempotent", async () => {
  const f = fixture();
  const stored = "2001:0DB8:0000:0000::/64";
  f.clients.get("one")!.set(stored, { client: stored, groups: [0], comment: "manual comment" });
  const dto: SubnetPlanDto = {
    client: "2001:db8::/64",
    operation: "save",
    groups: ["IoT"],
    targetInstanceIds: ["one"],
  };
  const preview = await f.service.preview(dto, REQUEST);
  await f.service.apply({ ...dto, previewToken: preview.previewToken }, REQUEST);
  assert.equal(f.writes[0]!.client, stored);
  assert.equal(f.writes[0]!.method, "update");
  assert.equal(f.clients.get("one")!.get(stored)!.comment, "manual comment");
  const deletion: SubnetPlanDto = { ...dto, operation: "delete" };
  const remove = await f.service.preview(deletion, REQUEST);
  await f.service.apply({ ...deletion, previewToken: remove.previewToken }, REQUEST);
  const again = await f.service.preview(deletion, REQUEST);
  assert.equal(again.targets[0]!.action, "unchanged");
});

test("invalid subnets and unknown targets fail before writing; duplicate rules are refused", async () => {
  const f = fixture();
  await assert.rejects(f.service.preview({ ...DTO, client: "192.0.2.4/24" }, REQUEST), /network address/);
  await assert.rejects(f.service.preview({ ...DTO, targetInstanceIds: ["unknown"] }, REQUEST), /Unknown/);
  await assert.rejects(f.service.preview({ ...DTO, groups: [] }, REQUEST), /Select at least/);
  const subnet = "2001:db8::/64";
  f.clients.get("one")!.set(subnet, { client: subnet, groups: [0], comment: "" });
  f.clients.get("one")!.set("2001:DB8::/64", { client: "2001:DB8::/64", groups: [0], comment: "" });
  const preview = await f.service.preview({ ...DTO, client: subnet }, REQUEST);
  assert.equal(preview.targets[0]!.action, "unavailable");
  assert.match(preview.targets[0]!.message!, /Duplicate subnet/);
  assert.equal(f.writes.length, 0);
});
