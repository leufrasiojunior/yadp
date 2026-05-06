import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeClientListResult,
  PiholeManagedInstanceSummary,
  PiholeNetworkDevice,
  PiholeNetworkDevicesResult,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { QueriesInstanceFailure, QueryGroupMembershipRefreshResponse, QueryGroupOption } from "./queries.types";
import { isIP } from "node:net";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ExistingClientDeviceRecord = {
  id: string;
  hwaddr: string;
  ips: string[];
  macVendor: string | null;
};

type NormalizedDeviceRecord = {
  hwaddr: string;
  ips: string[];
  macVendor: string | null;
};

type InstanceSnapshot = {
  instance: ManagedInstanceRecord;
  groupsById: Map<number, string>;
  groupNames: Set<string>;
  clients: PiholeClientListResult["clients"];
  devicesByHwaddr: Map<string, NormalizedDeviceRecord>;
  referencedHwaddrs: Set<string>;
};

type PreparedMembership = {
  groupId: number;
  clientKey: string;
  clientHwaddr: string | null;
  rawClientValue: string | null;
  rawClientName: string | null;
  resolvedIps: string[];
};

type PreparedInstanceCache = {
  instance: ManagedInstanceRecord;
  memberships: PreparedMembership[];
  missingGroupNames: string[];
  extraGroupNames: string[];
};

const MAC_ADDRESS_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeHwaddr(value: string) {
  return value.trim().toUpperCase();
}

function isLikelyMacAddress(value: string | null | undefined) {
  return MAC_ADDRESS_PATTERN.test(value?.trim() ?? "");
}

function normalizeIpArray(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => isIP(value) !== 0))].sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function normalizeGroupIds(value: unknown) {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  return [
    ...new Set(
      values
        .flatMap((entry) => `${entry}`.split(","))
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.max(0, Math.floor(entry))),
    ),
  ];
}

function sortManagedInstances<T extends ManagedInstanceRecord>(instances: T[]) {
  return [...instances].sort((left, right) => {
    if (left.isBaseline && !right.isBaseline) {
      return -1;
    }

    if (!left.isBaseline && right.isBaseline) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

@Injectable()
export class QueryGroupMembershipsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
  ) {}

  async refreshGroupMemberships(request: Request): Promise<QueryGroupMembershipRefreshResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();

    if (instances.length === 0) {
      return {
        updatedAt: null,
        summary: {
          totalInstances: 0,
          refreshedInstances: 0,
          failedInstances: 0,
          groupsCached: 0,
          membershipsCached: 0,
          instancesNeedingReview: 0,
        },
        requiresGroupReview: false,
        reviewPath: "/groups",
        failedInstances: [],
      };
    }

    const baseline = instances.find((instance) => instance.isBaseline) ?? null;

    if (!baseline) {
      return {
        updatedAt: null,
        summary: {
          totalInstances: instances.length,
          refreshedInstances: 0,
          failedInstances: 0,
          groupsCached: 0,
          membershipsCached: 0,
          instancesNeedingReview: instances.length,
        },
        requiresGroupReview: true,
        reviewPath: "/groups",
        failedInstances: [],
      };
    }

    const baselineResult = await this.readInstanceSnapshot(baseline, locale).catch((error) =>
      this.mapInstanceFailure(baseline, error, locale),
    );

    if ("kind" in baselineResult) {
      return {
        updatedAt: null,
        summary: {
          totalInstances: instances.length,
          refreshedInstances: 0,
          failedInstances: 1,
          groupsCached: 0,
          membershipsCached: 0,
          instancesNeedingReview: 1,
        },
        requiresGroupReview: true,
        reviewPath: "/groups",
        failedInstances: [baselineResult],
      };
    }

    const secondaryInstances = instances.filter((instance) => instance.id !== baseline.id);
    const settled = await Promise.all(
      secondaryInstances.map(async (instance) => {
        try {
          return {
            status: "fulfilled" as const,
            snapshot: await this.readInstanceSnapshot(instance, locale),
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            failure: this.mapInstanceFailure(instance, error, locale),
          };
        }
      }),
    );

    const successfulSnapshots: InstanceSnapshot[] = [baselineResult];
    const failedInstances: QueriesInstanceFailure[] = [];

    for (const result of settled) {
      if (result.status === "fulfilled") {
        successfulSnapshots.push(result.snapshot);
      } else {
        failedInstances.push(result.failure);
      }
    }

    const canonicalGroups = [...baselineResult.groupsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.id - right.id);
    const canonicalGroupsByName = new Map(canonicalGroups.map((group) => [group.name, group]));
    const referencedHwaddrs = new Set<string>();

    for (const snapshot of successfulSnapshots) {
      for (const hwaddr of snapshot.referencedHwaddrs) {
        referencedHwaddrs.add(hwaddr);
      }
    }

    const existingClientDevices = await this.loadExistingClientDevices([...referencedHwaddrs]);
    const preparedCaches = successfulSnapshots.map((snapshot) =>
      this.prepareInstanceCache(snapshot, canonicalGroupsByName, existingClientDevices),
    );
    const reviewInstanceIds = new Set<string>();

    for (const prepared of preparedCaches) {
      if (prepared.missingGroupNames.length > 0 || prepared.extraGroupNames.length > 0) {
        reviewInstanceIds.add(prepared.instance.id);
      }
    }

    for (const failure of failedInstances) {
      reviewInstanceIds.add(failure.instanceId);
    }

    const refreshedAt = new Date();
    const clientDeviceRecords = this.buildClientDeviceRecords(successfulSnapshots, existingClientDevices);
    const membershipsCached = preparedCaches.reduce((total, prepared) => total + prepared.memberships.length, 0);

    await this.prisma.$transaction(async (tx) => {
      if (canonicalGroups.length === 0) {
        await tx.clientGroupMembership.deleteMany({});
        await tx.clientGroup.deleteMany({});
      } else {
        const canonicalGroupIds = canonicalGroups.map((group) => group.id);

        await tx.clientGroupMembership.deleteMany({
          where: {
            groupId: {
              notIn: canonicalGroupIds,
            },
          },
        });
        await tx.clientGroup.deleteMany({
          where: {
            id: {
              notIn: canonicalGroupIds,
            },
          },
        });
      }

      for (const group of canonicalGroups) {
        await tx.clientGroup.upsert({
          where: {
            id: group.id,
          },
          update: {
            name: group.name,
          },
          create: {
            id: group.id,
            name: group.name,
          },
        });
      }

      for (const device of clientDeviceRecords) {
        await tx.clientDevice.upsert({
          where: {
            hwaddr: device.hwaddr,
          },
          update: {
            macVendor: device.macVendor,
            ips: device.ips,
          },
          create: {
            hwaddr: device.hwaddr,
            macVendor: device.macVendor,
            ips: device.ips,
          },
        });
      }

      const clientDeviceIdsByHwaddr = new Map<string, string>();

      if (clientDeviceRecords.length > 0) {
        const persistedClientDevices = await tx.clientDevice.findMany({
          where: {
            hwaddr: {
              in: clientDeviceRecords.map((device) => device.hwaddr),
            },
          },
          select: {
            id: true,
            hwaddr: true,
          },
        });

        for (const device of persistedClientDevices) {
          clientDeviceIdsByHwaddr.set(normalizeHwaddr(device.hwaddr), device.id);
        }
      }

      for (const prepared of preparedCaches) {
        await tx.clientGroupMembership.deleteMany({
          where: {
            instanceId: prepared.instance.id,
          },
        });

        if (prepared.memberships.length === 0) {
          continue;
        }

        await tx.clientGroupMembership.createMany({
          data: prepared.memberships.map((membership) => ({
            groupId: membership.groupId,
            instanceId: prepared.instance.id,
            clientKey: membership.clientKey,
            clientDeviceId:
              membership.clientHwaddr === null ? null : (clientDeviceIdsByHwaddr.get(membership.clientHwaddr) ?? null),
            rawClientValue: membership.rawClientValue,
            rawClientName: membership.rawClientName,
            resolvedIps: membership.resolvedIps,
            lastSyncedAt: refreshedAt,
            createdAt: refreshedAt,
            updatedAt: refreshedAt,
          })),
        });
      }
    });

    return {
      updatedAt: refreshedAt.toISOString(),
      summary: {
        totalInstances: instances.length,
        refreshedInstances: preparedCaches.length,
        failedInstances: failedInstances.length,
        groupsCached: canonicalGroups.length,
        membershipsCached,
        instancesNeedingReview: reviewInstanceIds.size,
      },
      requiresGroupReview: reviewInstanceIds.size > 0,
      reviewPath: "/groups",
      failedInstances,
    };
  }

  async listGroupOptions(): Promise<QueryGroupOption[]> {
    const items = await this.prisma.clientGroup.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }

  async loadAllowedIpsByInstance(groupIds: unknown, instanceIds: string[]) {
    const normalizedGroupIds = normalizeGroupIds(groupIds);
    const normalizedInstanceIds = [...new Set(instanceIds.map((instanceId) => instanceId.trim()).filter(Boolean))];

    if (normalizedGroupIds.length === 0 || normalizedInstanceIds.length === 0) {
      return new Map<string, Set<string>>();
    }

    const memberships = await this.prisma.clientGroupMembership.findMany({
      where: {
        groupId: {
          in: normalizedGroupIds,
        },
        instanceId: {
          in: normalizedInstanceIds,
        },
      },
      select: {
        instanceId: true,
        resolvedIps: true,
      },
    });
    const lookup = new Map<string, Set<string>>();

    for (const membership of memberships) {
      const values = lookup.get(membership.instanceId) ?? new Set<string>();

      for (const ip of normalizeIpArray(membership.resolvedIps)) {
        values.add(ip);
      }

      lookup.set(membership.instanceId, values);
    }

    return lookup;
  }

  private async loadManagedInstances(): Promise<ManagedInstanceRecord[]> {
    const instances = await this.prisma.instance.findMany({
      where: {
        syncEnabled: true,
      },
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
        isBaseline: true,
      },
    });

    return sortManagedInstances(
      instances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        baseUrl: instance.baseUrl,
        isBaseline: instance.isBaseline,
      })),
    );
  }

  private async readInstanceSnapshot(
    instance: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InstanceSnapshot> {
    const [groupsResult, clientsResult, devicesResult] = await this.instanceSessions.withActiveSession(
      instance.id,
      locale,
      ({ connection, session }) =>
        Promise.all([
          this.pihole.listGroups(connection, session),
          this.pihole.listClients(connection, session),
          this.pihole.listNetworkDevices(connection, session),
        ]),
    );
    const groupsById = new Map<number, string>();
    const groupNames = new Set<string>();

    for (const group of groupsResult.groups) {
      const name = normalizeOptionalString(group.name);

      if (group.id === null || name === null) {
        continue;
      }

      groupsById.set(group.id, name);
      groupNames.add(name);
    }

    const devicesByHwaddr = this.normalizeDevicesByHwaddr(devicesResult);
    const referencedHwaddrs = new Set<string>(devicesByHwaddr.keys());

    for (const client of clientsResult.clients) {
      const hwaddr = this.resolveMembershipHwaddr(client.client, client.name);

      if (hwaddr !== null) {
        referencedHwaddrs.add(hwaddr);
      }
    }

    return {
      instance,
      groupsById,
      groupNames,
      clients: clientsResult.clients,
      devicesByHwaddr,
      referencedHwaddrs,
    };
  }

  private normalizeDevicesByHwaddr(devicesResult: PiholeNetworkDevicesResult) {
    const devicesByHwaddr = new Map<string, NormalizedDeviceRecord>();

    for (const device of devicesResult.devices) {
      const normalized = this.normalizeDeviceRecord(device);

      if (!normalized) {
        continue;
      }

      const current = devicesByHwaddr.get(normalized.hwaddr);

      if (!current) {
        devicesByHwaddr.set(normalized.hwaddr, normalized);
        continue;
      }

      devicesByHwaddr.set(normalized.hwaddr, {
        hwaddr: normalized.hwaddr,
        macVendor: current.macVendor ?? normalized.macVendor,
        ips: normalizeIpArray([...current.ips, ...normalized.ips]),
      });
    }

    return devicesByHwaddr;
  }

  private normalizeDeviceRecord(device: PiholeNetworkDevice): NormalizedDeviceRecord | null {
    const hwaddr = normalizeOptionalString(device.hwaddr);

    if (!hwaddr || !isLikelyMacAddress(hwaddr)) {
      return null;
    }

    return {
      hwaddr: normalizeHwaddr(hwaddr),
      ips: normalizeIpArray(device.ips.map((entry) => entry.ip ?? "")),
      macVendor: normalizeOptionalString(device.macVendor),
    };
  }

  private async loadExistingClientDevices(hwaddrs: string[]) {
    if (hwaddrs.length === 0) {
      return new Map<string, ExistingClientDeviceRecord>();
    }

    const items = await this.prisma.clientDevice.findMany({
      where: {
        hwaddr: {
          in: hwaddrs,
        },
      },
      select: {
        id: true,
        hwaddr: true,
        ips: true,
        macVendor: true,
      },
    });

    return new Map(
      items.map((item) => [
        normalizeHwaddr(item.hwaddr),
        {
          id: item.id,
          hwaddr: normalizeHwaddr(item.hwaddr),
          ips: normalizeIpArray(item.ips),
          macVendor: normalizeOptionalString(item.macVendor),
        },
      ]),
    );
  }

  private prepareInstanceCache(
    snapshot: InstanceSnapshot,
    canonicalGroupsByName: Map<string, { id: number; name: string }>,
    existingClientDevices: Map<string, ExistingClientDeviceRecord>,
  ): PreparedInstanceCache {
    const canonicalGroupNames = new Set(canonicalGroupsByName.keys());
    const membershipEntries = new Map<string, PreparedMembership>();
    const missingGroupNames = [...canonicalGroupNames]
      .filter((groupName) => !snapshot.groupNames.has(groupName))
      .sort((left, right) => left.localeCompare(right));
    const extraGroupNames = [...snapshot.groupNames]
      .filter((groupName) => !canonicalGroupNames.has(groupName))
      .sort((left, right) => left.localeCompare(right));

    for (const client of snapshot.clients) {
      const rawClientValue = normalizeOptionalString(client.client);
      const rawClientName = normalizeOptionalString(client.name);
      const clientKey = this.resolveMembershipClientKey(rawClientValue, rawClientName);

      if (!clientKey) {
        continue;
      }

      const clientHwaddr = this.resolveMembershipHwaddr(rawClientValue, rawClientName);
      const resolvedIps = this.resolveManagedClientIps(
        rawClientValue,
        rawClientName,
        snapshot.devicesByHwaddr,
        existingClientDevices,
      );

      for (const localGroupId of [...new Set(client.groups)]) {
        const groupName = snapshot.groupsById.get(localGroupId);

        if (!groupName) {
          continue;
        }

        const canonicalGroup = canonicalGroupsByName.get(groupName);

        if (!canonicalGroup) {
          continue;
        }

        const membershipKey = `${canonicalGroup.id}:${clientKey}`;
        const current = membershipEntries.get(membershipKey);

        if (!current) {
          membershipEntries.set(membershipKey, {
            groupId: canonicalGroup.id,
            clientKey,
            clientHwaddr,
            rawClientValue,
            rawClientName,
            resolvedIps,
          });
          continue;
        }

        membershipEntries.set(membershipKey, {
          ...current,
          clientHwaddr: current.clientHwaddr ?? clientHwaddr,
          rawClientValue: current.rawClientValue ?? rawClientValue,
          rawClientName: current.rawClientName ?? rawClientName,
          resolvedIps: normalizeIpArray([...current.resolvedIps, ...resolvedIps]),
        });
      }
    }

    return {
      instance: snapshot.instance,
      memberships: [...membershipEntries.values()],
      missingGroupNames,
      extraGroupNames,
    };
  }

  private buildClientDeviceRecords(
    snapshots: InstanceSnapshot[],
    existingClientDevices: Map<string, ExistingClientDeviceRecord>,
  ) {
    const records = new Map<string, { hwaddr: string; ips: string[]; macVendor: string | null }>();

    for (const snapshot of snapshots) {
      for (const device of snapshot.devicesByHwaddr.values()) {
        const current = records.get(device.hwaddr);

        if (!current) {
          records.set(device.hwaddr, {
            hwaddr: device.hwaddr,
            ips: device.ips,
            macVendor: device.macVendor,
          });
          continue;
        }

        records.set(device.hwaddr, {
          hwaddr: device.hwaddr,
          ips: normalizeIpArray([...current.ips, ...device.ips]),
          macVendor: current.macVendor ?? device.macVendor,
        });
      }

      for (const hwaddr of snapshot.referencedHwaddrs) {
        if (records.has(hwaddr)) {
          continue;
        }

        const existing = existingClientDevices.get(hwaddr);

        records.set(hwaddr, {
          hwaddr,
          ips: existing?.ips ?? [],
          macVendor: existing?.macVendor ?? null,
        });
      }
    }

    return [...records.values()].sort((left, right) => left.hwaddr.localeCompare(right.hwaddr));
  }

  private resolveMembershipClientKey(rawClientValue: string | null, rawClientName: string | null) {
    for (const candidate of [rawClientValue, rawClientName]) {
      if (!candidate) {
        continue;
      }

      if (isLikelyMacAddress(candidate)) {
        return normalizeHwaddr(candidate);
      }

      if (isIP(candidate) !== 0) {
        return candidate;
      }
    }

    return rawClientValue ?? rawClientName;
  }

  private resolveMembershipHwaddr(rawClientValue: string | null, rawClientName: string | null) {
    for (const candidate of [rawClientValue, rawClientName]) {
      if (candidate && isLikelyMacAddress(candidate)) {
        return normalizeHwaddr(candidate);
      }
    }

    return null;
  }

  private resolveManagedClientIps(
    rawClientValue: string | null,
    rawClientName: string | null,
    devicesByHwaddr: Map<string, NormalizedDeviceRecord>,
    existingClientDevices: Map<string, ExistingClientDeviceRecord>,
  ) {
    const ips = new Set<string>();

    for (const candidate of [rawClientValue, rawClientName]) {
      if (!candidate) {
        continue;
      }

      if (isIP(candidate) !== 0) {
        ips.add(candidate);
        continue;
      }

      if (!isLikelyMacAddress(candidate)) {
        continue;
      }

      const hwaddr = normalizeHwaddr(candidate);

      for (const ip of devicesByHwaddr.get(hwaddr)?.ips ?? existingClientDevices.get(hwaddr)?.ips ?? []) {
        if (isIP(ip) !== 0) {
          ips.add(ip);
        }
      }
    }

    return normalizeIpArray([...ips]);
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): QueriesInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: this.resolveFailureMessage(instance, error, locale),
      };
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown",
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private resolveFailureMessage(
    instance: PiholeManagedInstanceSummary,
    error: PiholeRequestError,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (error.kind === "invalid_credentials") {
      return translateApi(locale, "pihole.invalidTechnicalCredentials", {
        baseUrl: instance.baseUrl,
      });
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }

    return this.getFailureFallbackMessage(error.kind, instance.baseUrl, locale);
  }

  private getFailureFallbackMessage(
    kind: PiholeRequestErrorKind,
    baseUrl: string,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    switch (kind) {
      case "timeout":
        return translateApi(locale, "pihole.timeout", { baseUrl });
      case "dns_error":
        return translateApi(locale, "pihole.unresolved", { baseUrl });
      case "connection_refused":
        return translateApi(locale, "pihole.refused", { baseUrl });
      case "tls_error":
        return translateApi(locale, "pihole.tls", { baseUrl });
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }
}
