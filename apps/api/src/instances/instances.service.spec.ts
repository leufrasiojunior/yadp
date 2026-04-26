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
  prisma?: {
    instance?: {
      findUnique?: (...args: unknown[]) => Promise<unknown>;
      findFirst?: (...args: unknown[]) => Promise<unknown>;
      update?: (...args: unknown[]) => Promise<unknown>;
      updateMany?: (...args: unknown[]) => Promise<unknown>;
      count?: (...args: unknown[]) => Promise<unknown>;
    };
    $transaction?: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T>;
  };
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

  const prisma =
    options?.prisma ??
    ({
      instance: {
        findUnique: async () => null,
        findFirst: async () => null,
        update: async () => null,
        updateMany: async () => ({ count: 0 }),
        count: async () => 0,
      },
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback((options?.prisma as unknown) ?? {}),
    } satisfies {
      instance: {
        findUnique: (...args: unknown[]) => Promise<unknown>;
        findFirst: (...args: unknown[]) => Promise<unknown>;
        update: (...args: unknown[]) => Promise<unknown>;
        updateMany: (...args: unknown[]) => Promise<unknown>;
        count: (...args: unknown[]) => Promise<unknown>;
      };
      $transaction: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T>;
    });

  const service = new InstancesService(
    audit as never,
    {} as never,
    instanceSessions as never,
    pihole as never,
    {} as never,
    prisma as never,
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

test("promotePrimaryInstance promotes a secondary instance and preserves the old sync flag", async () => {
  const instances = [
    { id: "baseline-1", name: "Baseline", isBaseline: true, syncEnabled: true },
    { id: "secondary-1", name: "Secondary", isBaseline: false, syncEnabled: false },
  ];

  const prisma = {
    instance: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) =>
        instances.find((instance) => instance.id === id) ?? null,
      findFirst: async () => instances.find((instance) => instance.isBaseline) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { isBaseline: boolean; NOT: { id: string } };
        data: { isBaseline: boolean };
      }) => {
        let count = 0;
        for (const instance of instances) {
          if (instance.isBaseline === where.isBaseline && instance.id !== where.NOT.id) {
            instance.isBaseline = data.isBaseline;
            count += 1;
          }
        }
        return { count };
      },
      update: async ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: { isBaseline: boolean; syncEnabled: boolean };
      }) => {
        const instance = instances.find((entry) => entry.id === id);
        assert.ok(instance);
        instance.isBaseline = data.isBaseline;
        instance.syncEnabled = data.syncEnabled;
        return { ...instance };
      },
      count: async () => instances.filter((instance) => instance.isBaseline).length,
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
  };

  const { service, auditCalls } = createService({ prisma });

  const result = await service.promotePrimaryInstance("secondary-1", REQUEST);

  assert.equal(result.previousBaselineId, "baseline-1");
  assert.deepEqual(result.instance, {
    id: "secondary-1",
    name: "Secondary",
    isBaseline: true,
    syncEnabled: true,
  });
  assert.deepEqual(
    instances.map((instance) => ({
      id: instance.id,
      isBaseline: instance.isBaseline,
      syncEnabled: instance.syncEnabled,
    })),
    [
      { id: "baseline-1", isBaseline: false, syncEnabled: true },
      { id: "secondary-1", isBaseline: true, syncEnabled: true },
    ],
  );
  assert.deepEqual(auditCalls, [{ action: "instances.primary.change", result: "SUCCESS" }]);
});

test("promotePrimaryInstance fails for an unknown instance", async () => {
  const prisma = {
    instance: {
      findUnique: async () => null,
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      update: async () => null,
      count: async () => 0,
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
  };

  const { service, auditCalls } = createService({ prisma });

  await assert.rejects(() => service.promotePrimaryInstance("missing", REQUEST), NotFoundException);
  assert.deepEqual(auditCalls, []);
});
