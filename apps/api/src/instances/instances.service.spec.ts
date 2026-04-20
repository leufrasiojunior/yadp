import { NotFoundException } from "@nestjs/common";
import type { Request } from "express";

import { PiholeRequestError } from "../pihole/pihole.service";
import { InstancesService } from "./instances.service";
import assert from "node:assert/strict";
import test from "node:test";

const REQUEST = {
  headers: {},
} as Request;

function createService(options?: {
  withActiveSession?: InstancesService["getInstanceInfo"] extends never
    ? never
    : (
        instanceId: string,
        locale: unknown,
        callback: (context: {
          connection: { baseUrl: string };
          session: { sid: string; csrf: string };
        }) => Promise<unknown>,
        access?: { allowDisabled?: boolean },
      ) => Promise<unknown>;
  readVersionDetails?: () => Promise<unknown>;
  readHostInfo?: () => Promise<unknown>;
  readSystemInfo?: () => Promise<unknown>;
}) {
  const auditCalls: Array<{ action: string; result: string }> = [];

  const audit = {
    record: async ({ action, result }: { action: string; result: string }) => {
      auditCalls.push({ action, result });
    },
  };

  const instanceSessions = {
    withActiveSession:
      options?.withActiveSession ??
      (async (
        _instanceId: string,
        _locale: unknown,
        callback: (context: {
          connection: { baseUrl: string };
          session: { sid: string; csrf: string };
        }) => Promise<unknown>,
      ) =>
        callback({
          connection: { baseUrl: "https://pi.hole" },
          session: { sid: "sid", csrf: "csrf" },
        })),
  };

  const pihole = {
    readVersionDetails:
      options?.readVersionDetails ??
      (async () => ({
        summary: "v6.4.1 / v6.5",
        core: { local: { version: "v6.4.1", branch: "master", hash: "abc", date: null }, remote: null },
        web: { local: { version: "v6.5", branch: "master", hash: "def", date: null }, remote: null },
        ftl: null,
        docker: null,
      })),
    readHostInfo:
      options?.readHostInfo ??
      (async () => ({
        model: "Raspberry Pi 4",
        nodename: "pihole",
        machine: "aarch64",
        sysname: "Linux",
        release: "6.12",
        version: "#1 SMP",
        domainname: "(none)",
      })),
    readSystemInfo:
      options?.readSystemInfo ??
      (async () => ({
        uptime: 120,
        memory: {
          ram: { total: 100, free: 50, used: 50, available: 75, percentUsed: 50 },
          swap: null,
        },
        procs: 100,
        cpu: {
          nprocs: 4,
          percentCpu: 1.5,
          load: { raw: [0.1, 0.2, 0.3], percent: [2.5, 5, 7.5] },
        },
        ftl: { percentMem: 2.5, percentCpu: 1.1 },
      })),
  };

  const service = new InstancesService(
    audit as never,
    {} as never,
    instanceSessions as never,
    pihole as never,
    {} as never,
    {} as never,
  );

  return {
    service,
    auditCalls,
  };
}

test("getInstanceInfo returns normalized live Pi-hole info", async () => {
  const { service, auditCalls } = createService();

  const result = await service.getInstanceInfo("instance-1", REQUEST);

  assert.equal(result.instanceId, "instance-1");
  assert.equal(result.version.summary, "v6.4.1 / v6.5");
  assert.equal(result.host.model, "Raspberry Pi 4");
  assert.equal(result.system.cpu?.nprocs, 4);
  assert.ok(result.fetchedAt);
  assert.deepEqual(auditCalls, [{ action: "instances.info", result: "SUCCESS" }]);
});

test("getInstanceInfo keeps 404 from instance lookup", async () => {
  const { service, auditCalls } = createService({
    withActiveSession: async () => {
      throw new NotFoundException("missing");
    },
  });

  await assert.rejects(() => service.getInstanceInfo("missing", REQUEST), NotFoundException);
  assert.deepEqual(auditCalls, [{ action: "instances.info", result: "FAILURE" }]);
});

test("getInstanceInfo maps Pi-hole request failures consistently", async () => {
  const { service, auditCalls } = createService({
    readVersionDetails: async () => {
      throw new PiholeRequestError(502, "upstream failed", "unknown");
    },
  });

  await assert.rejects(() => service.getInstanceInfo("instance-1", REQUEST), {
    message: "upstream failed",
    name: "BadGatewayException",
  });
  assert.deepEqual(auditCalls, [{ action: "instances.info", result: "FAILURE" }]);
});
