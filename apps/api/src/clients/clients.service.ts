import { BadGatewayException, BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeClientMutationResult,
  PiholeManagedClientEntry,
  PiholeManagedGroupEntry,
  PiholeManagedInstanceSummary,
  PiholeNetworkDevice,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import { hasMatchingClientTag, normalizeClientTags } from "./client-tags";
import type {
  ClientListSortDirection,
  ClientListSortField,
  ClientsListResponse,
  ClientsMutationInstanceFailure,
  ClientsMutationInstanceSource,
  ClientsMutationResponse,
} from "./clients.types";
import type { GetClientsDto } from "./dto/get-clients.dto";
import type { SaveClientsDto } from "./dto/save-clients.dto";
import type { SyncClientsDto } from "./dto/sync-clients.dto";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedGroupRecord = {
  id: number;
  name: string;
};

type ManagedClientRecord = {
  client: string;
  comment: string | null;
  groups: number[];
};

type DeviceObservation = {
  hwaddr: string;
  macVendor: string | null;
  ips: string[];
  firstSeen: number | null;
  lastQuery: number | null;
  numQueries: number;
};

type PendingDeviceObservation = {
  rawHwaddr: string | null;
  macVendor: string | null;
  ips: string[];
  firstSeen: number | null;
  lastQuery: number | null;
  numQueries: number;
};

type InstanceDevicesSnapshot = {
  instance: ManagedInstanceRecord;
  devicesByHwaddr: Map<string, DeviceObservation>;
  unresolvedDevices: PendingDeviceObservation[];
};

type BaselineClientMetadata = {
  comment: string | null;
  groupIds: number[];
  groupNames: string[];
};

type BaselineMetadataSnapshot = {
  clientsByHwaddr: Map<string, BaselineClientMetadata>;
};

type ClientSupportEntry = {
  alias: string | null;
  tags: string[];
};

type InstanceApplySnapshot = {
  groupsByName: Map<string, ManagedGroupRecord>;
  clientsByHwaddr: Map<string, ManagedClientRecord>;
};

const MAC_ADDRESS_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

function normalizeHwaddr(value: string) {
  return value.trim().toUpperCase();
}

function isLikelyMacAddress(value: string) {
  return MAC_ADDRESS_PATTERN.test(value.trim());
}

function normalizeStringArray(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function mergeDeviceObservationLike<T extends Omit<DeviceObservation, "hwaddr">>(current: T, incoming: T): T {
  return {
    ...current,
    macVendor: current.macVendor ?? incoming.macVendor,
    ips: normalizeStringArray([...current.ips, ...incoming.ips]),
    firstSeen:
      current.firstSeen === null
        ? incoming.firstSeen
        : incoming.firstSeen === null
          ? current.firstSeen
          : Math.min(current.firstSeen, incoming.firstSeen),
    lastQuery:
      current.lastQuery === null
        ? incoming.lastQuery
        : incoming.lastQuery === null
          ? current.lastQuery
          : Math.max(current.lastQuery, incoming.lastQuery),
    numQueries: Math.max(current.numQueries, incoming.numQueries),
  };
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

function sortInstanceSources<T extends ClientsMutationInstanceSource>(instances: T[], baselineInstanceId: string) {
  return [...instances].sort((left, right) => {
    if (left.instanceId === baselineInstanceId && right.instanceId !== baselineInstanceId) {
      return -1;
    }

    if (left.instanceId !== baselineInstanceId && right.instanceId === baselineInstanceId) {
      return 1;
    }

    return left.instanceName.localeCompare(right.instanceName);
  });
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return compareStrings(left?.trim() ?? "", right?.trim() ?? "");
}

function compareNullableNumbers(left: number | null | undefined, right: number | null | undefined) {
  return (left ?? Number.NEGATIVE_INFINITY) - (right ?? Number.NEGATIVE_INFINITY);
}

function getClientPrimaryIp(item: Pick<ClientsListResponse["items"][number], "ips">) {
  return item.ips.find((ip) => ip.trim().length > 0) ?? null;
}

function getClientSortValue(item: ClientsListResponse["items"][number]) {
  const alias = item.alias?.trim() ?? "";
  const ip = getClientPrimaryIp(item) ?? "";

  if (alias.length > 0 && ip.length > 0) {
    return `${alias}(${ip})`;
  }

  if (alias.length > 0) {
    return alias;
  }

  if (ip.length > 0) {
    return ip;
  }

  return item.hwaddr;
}

function getClientGroupSortValue(item: ClientsListResponse["items"][number]) {
  if (item.groupNames.length > 0) {
    return item.groupNames.join(", ");
  }

  return item.groupIds.map((groupId) => `${groupId}`).join(", ");
}

function matchesClientSearch(item: ClientsListResponse["items"][number], rawSearchTerm: string) {
  const searchTerm = rawSearchTerm.trim().toLowerCase();

  if (searchTerm.length === 0) {
    return true;
  }

  const candidateValues = [getClientSortValue(item), item.alias ?? "", item.hwaddr, ...item.ips];

  return candidateValues.some((value) => value.trim().toLowerCase().includes(searchTerm));
}

function matchesExcludedTags(item: ClientsListResponse["items"][number], excludedTags: string[]) {
  if (excludedTags.length === 0) {
    return false;
  }

  return excludedTags.some((tag) => hasMatchingClientTag(item.tags, tag));
}

function sortClientItems(
  items: ClientsListResponse["items"],
  sortBy: ClientListSortField,
  sortDirection: ClientListSortDirection,
) {
  return [...items].sort((left, right) => {
    let result = 0;

    switch (sortBy) {
      case "client":
        result = compareStrings(getClientSortValue(left), getClientSortValue(right));
        break;
      case "instance":
        result = compareStrings(left.instance.instanceName, right.instance.instanceName);
        break;
      case "group":
        result = compareStrings(getClientGroupSortValue(left), getClientGroupSortValue(right));
        break;
      case "firstSeen":
        result = compareNullableNumbers(
          left.firstSeen ? new Date(left.firstSeen).getTime() : null,
          right.firstSeen ? new Date(right.firstSeen).getTime() : null,
        );
        break;
      case "lastQuery":
        result = compareNullableNumbers(
          left.lastQuery ? new Date(left.lastQuery).getTime() : null,
          right.lastQuery ? new Date(right.lastQuery).getTime() : null,
        );
        break;
      case "numQueries":
        result = left.numQueries - right.numQueries;
        break;
      case "comment":
        result = compareNullableStrings(left.comment, right.comment);
        break;
      default:
        result = 0;
        break;
    }

    if (result === 0) {
      result = compareStrings(left.hwaddr, right.hwaddr);
    }

    return sortDirection === "asc" ? result : -result;
  });
}

function sortNumberArray(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

function areNumberArraysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

@Injectable()
export class ClientsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listClients(query: GetClientsDto, request: Request): Promise<ClientsListResponse> {
    const locale = getRequestLocale(request);
    const searchTerm = query.search?.trim() ?? "";
    const excludedTags = query.excludedTags ?? [];
    const instances = await this.loadManagedInstances(locale);
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots, unavailableInstances } = await this.prepareDeviceSnapshotsForList(instances, locale);
    const baselineMetadata = await this.readBaselineMetadata(baseline, locale).catch(() => ({
      clientsByHwaddr: new Map<string, BaselineClientMetadata>(),
    }));
    const allHwaddrs = [...new Set(snapshots.flatMap((snapshot) => [...snapshot.devicesByHwaddr.keys()]))];
    const supportEntries = await this.loadSupportEntries(allHwaddrs);
    const availableTags = await this.loadAvailableTags();
    const items = this.buildListedClients(snapshots, baseline.id, baselineMetadata.clientsByHwaddr, supportEntries);
    const filteredItems = searchTerm.length > 0 ? items.filter((item) => matchesClientSearch(item, searchTerm)) : items;
    const tagFilteredItems =
      excludedTags.length > 0
        ? filteredItems.filter((item) => !matchesExcludedTags(item, excludedTags))
        : filteredItems;
    const sortedItems = sortClientItems(tagFilteredItems, query.sortBy, query.sortDirection);

    await this.persistSupportEntries(items, supportEntries);

    const totalItems = sortedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const startIndex = (page - 1) * query.pageSize;

    return {
      items: sortedItems.slice(startIndex, startIndex + query.pageSize),
      availableTags,
      pagination: {
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
      source: {
        baselineInstanceId: baseline.id,
        baselineInstanceName: baseline.name,
        totalInstances: instances.length,
        availableInstanceCount: snapshots.length,
        unavailableInstanceCount: unavailableInstances.length,
      },
      unavailableInstances,
    };
  }

  async saveClients(dto: SaveClientsDto, request: Request): Promise<ClientsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);
    const clients = this.normalizeRequestedClients(dto.client, locale);
    const comment = dto.comment === undefined ? undefined : dto.comment.trim();
    const alias = dto.alias === undefined ? undefined : dto.alias.trim();
    const requestedGroupIds = dto.groups ?? [];
    const tags = dto.tags === undefined ? undefined : normalizeClientTags(dto.tags);

    try {
      const instances = await this.loadManagedInstances(locale);
      const targetInstances = this.resolveSaveTargets(instances, dto.targetInstanceIds, locale);
      const baselineGroups =
        requestedGroupIds.length > 0 ? await this.readBaselineGroups(instances, requestedGroupIds, locale) : null;
      await this.persistRequestedSupportMetadata(clients, alias, tags);

      if (baselineGroups === null && comment === undefined) {
        const successfulInstances = targetInstances.map((instance) => this.toSourceSummary(instance));
        const response = this.buildMutationResponse(targetInstances.length, successfulInstances, []);

        await this.audit.record({
          action: "clients.save",
          actorType: "session",
          ipAddress,
          targetType: "client",
          targetId: clients.length === 1 ? clients[0] : null,
          result: "SUCCESS",
          details: {
            clients,
            groups: requestedGroupIds,
            groupNames: [],
            targetInstanceIds: targetInstances.map((instance) => instance.id),
            status: response.status,
            summary: response.summary,
            comment: comment ?? null,
            alias: alias ?? null,
            tags: tags ?? [],
          } satisfies Prisma.InputJsonObject,
        });

        return response;
      }

      const successfulInstances: ClientsMutationInstanceSource[] = [];
      const failedInstances: ClientsMutationInstanceFailure[] = [];

      for (const instance of targetInstances) {
        try {
          await this.applyClientsToInstance(instance, clients, baselineGroups, comment, locale);
          successfulInstances.push(this.toSourceSummary(instance));
        } catch (error) {
          failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        }
      }

      const response = this.buildMutationResponse(targetInstances.length, successfulInstances, failedInstances);

      await this.audit.record({
        action: "clients.save",
        actorType: "session",
        ipAddress,
        targetType: "client",
        targetId: clients.length === 1 ? clients[0] : null,
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          clients,
          groups: requestedGroupIds,
          groupNames: baselineGroups?.map((group) => group.name) ?? [],
          targetInstanceIds: targetInstances.map((instance) => instance.id),
          status: response.status,
          summary: response.summary,
          failedInstances: response.failedInstances as unknown as Prisma.InputJsonValue,
          comment: comment ?? null,
          alias: alias ?? null,
          tags: tags ?? [],
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "clients.save",
        actorType: "session",
        ipAddress,
        targetType: "client",
        result: "FAILURE",
        details: {
          clients,
          groups: requestedGroupIds,
          targetInstanceIds: dto.targetInstanceIds ?? [],
          comment: comment ?? null,
          alias: alias ?? null,
          tags: tags ?? [],
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  async syncClients(dto: SyncClientsDto | undefined, request: Request): Promise<ClientsMutationResponse> {
    const locale = getRequestLocale(request);
    const ipAddress = getRequestIp(request);

    try {
      const instances = await this.loadManagedInstances(locale);
      const baseline = instances.find((instance) => instance.isBaseline);

      if (!baseline) {
        throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
      }

      const targetInstances = this.resolveSyncTargets(instances, baseline.id, dto?.targetInstanceIds, locale);
      const sourceSnapshot = await this.readBaselineSyncSource(baseline, locale);
      const successfulInstances: ClientsMutationInstanceSource[] = [];
      const failedInstances: ClientsMutationInstanceFailure[] = [];

      for (const instance of targetInstances) {
        try {
          await this.syncClientsToInstance(instance, sourceSnapshot, locale);
          successfulInstances.push(this.toSourceSummary(instance));
        } catch (error) {
          failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        }
      }

      const response = this.buildMutationResponse(targetInstances.length, successfulInstances, failedInstances);

      await this.audit.record({
        action: "clients.sync",
        actorType: "session",
        ipAddress,
        targetType: "client",
        result: response.failedInstances.length > 0 ? "FAILURE" : "SUCCESS",
        details: {
          sourceBaselineId: baseline.id,
          sourceBaselineName: baseline.name,
          targetInstanceIds: targetInstances.map((instance) => instance.id),
          status: response.status,
          summary: response.summary,
          failedInstances: response.failedInstances as unknown as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonObject,
      });

      return response;
    } catch (error) {
      await this.audit.record({
        action: "clients.sync",
        actorType: "session",
        ipAddress,
        targetType: "client",
        result: "FAILURE",
        details: {
          targetInstanceIds: dto?.targetInstanceIds ?? [],
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies Prisma.InputJsonObject,
      });

      throw error;
    }
  }

  private async loadManagedInstances(locale: ReturnType<typeof getRequestLocale>): Promise<ManagedInstanceRecord[]> {
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

    if (instances.length === 0) {
      throw new BadRequestException(translateApi(locale, "clients.noInstances"));
    }

    return instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      isBaseline: instance.isBaseline,
    }));
  }

  private normalizeRequestedClients(rawClients: string[], locale: ReturnType<typeof getRequestLocale>) {
    const clients = [...new Set(rawClients.map((client) => normalizeHwaddr(client)).filter(Boolean))];

    if (clients.length === 0) {
      throw new BadRequestException(translateApi(locale, "clients.emptySelection"));
    }

    if (clients.some((client) => !isLikelyMacAddress(client))) {
      throw new BadRequestException(translateApi(locale, "clients.invalidClient"));
    }

    return clients;
  }

  private resolveSaveTargets(
    instances: ManagedInstanceRecord[],
    targetInstanceIds: string[] | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (!targetInstanceIds || targetInstanceIds.length === 0) {
      return sortManagedInstances(instances);
    }

    const instancesById = new Map(instances.map((instance) => [instance.id, instance]));
    const targets = targetInstanceIds.map((instanceId) => instancesById.get(instanceId) ?? null);

    if (targets.some((instance) => instance === null)) {
      throw new BadRequestException(translateApi(locale, "sync.invalidTargetInstances"));
    }

    return sortManagedInstances(targets.filter((instance): instance is ManagedInstanceRecord => instance !== null));
  }

  private resolveSyncTargets(
    instances: ManagedInstanceRecord[],
    baselineInstanceId: string,
    targetInstanceIds: string[] | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const candidateTargets = instances.filter((instance) => instance.id !== baselineInstanceId);

    if (!targetInstanceIds || targetInstanceIds.length === 0) {
      return sortManagedInstances(candidateTargets);
    }

    const instancesById = new Map(candidateTargets.map((instance) => [instance.id, instance]));
    const targets = targetInstanceIds.map((instanceId) => instancesById.get(instanceId) ?? null);

    if (targets.some((instance) => instance === null)) {
      throw new BadRequestException(translateApi(locale, "sync.invalidTargetInstances"));
    }

    return sortManagedInstances(targets.filter((instance): instance is ManagedInstanceRecord => instance !== null));
  }

  private async prepareDeviceSnapshotsForList(
    instances: ManagedInstanceRecord[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const settled = await Promise.allSettled(instances.map((instance) => this.readDevicesSnapshot(instance, locale)));
    const snapshots: InstanceDevicesSnapshot[] = [];
    const unavailableInstances: ClientsMutationInstanceFailure[] = [];

    settled.forEach((result, index) => {
      const instance = instances[index];

      if (!instance) {
        return;
      }

      if (result.status === "fulfilled") {
        snapshots.push(result.value);
        return;
      }

      unavailableInstances.push(this.mapInstanceFailure(instance, result.reason, locale));
    });

    return {
      snapshots,
      unavailableInstances,
    };
  }

  private async readDevicesSnapshot(
    instance: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InstanceDevicesSnapshot> {
    const result = await this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
      this.pihole.listNetworkDevices(connection, session),
    );
    const devicesByHwaddr = new Map<string, DeviceObservation>();
    const unresolvedDevicesByKey = new Map<string, PendingDeviceObservation>();

    for (const entry of result.devices) {
      const candidate = this.toDeviceObservationCandidate(entry);

      if (!candidate) {
        continue;
      }

      if ("hwaddr" in candidate) {
        const existing = devicesByHwaddr.get(candidate.hwaddr);
        devicesByHwaddr.set(candidate.hwaddr, existing ? this.mergeDeviceObservation(existing, candidate) : candidate);
        continue;
      }

      const unresolvedKey = `${candidate.rawHwaddr ?? "unknown"}|${candidate.ips.join(",")}`;
      const existingUnresolved = unresolvedDevicesByKey.get(unresolvedKey);
      unresolvedDevicesByKey.set(
        unresolvedKey,
        existingUnresolved ? this.mergePendingDeviceObservation(existingUnresolved, candidate) : candidate,
      );
    }

    return {
      instance,
      devicesByHwaddr,
      unresolvedDevices: [...unresolvedDevicesByKey.values()],
    };
  }

  private toDeviceObservationCandidate(
    entry: PiholeNetworkDevice,
  ): DeviceObservation | PendingDeviceObservation | null {
    const rawHwaddr = entry.hwaddr?.trim() ?? "";
    const normalizedHwaddr = rawHwaddr.length > 0 ? normalizeHwaddr(rawHwaddr) : null;
    const ips = normalizeStringArray(entry.ips.map((address) => address.ip ?? ""));

    if (!normalizedHwaddr && ips.length === 0) {
      return null;
    }

    const baseObservation = {
      macVendor: entry.macVendor?.trim().length ? entry.macVendor.trim() : null,
      ips,
      firstSeen: entry.firstSeen,
      lastQuery: entry.lastQuery,
      numQueries: entry.numQueries ?? 0,
    } satisfies Omit<DeviceObservation, "hwaddr">;

    if (normalizedHwaddr && isLikelyMacAddress(normalizedHwaddr)) {
      return {
        hwaddr: normalizedHwaddr,
        ...baseObservation,
      };
    }

    if (ips.length === 0) {
      return null;
    }

    return {
      rawHwaddr: normalizedHwaddr,
      ...baseObservation,
    };
  }

  private mergeDeviceObservation(current: DeviceObservation, incoming: DeviceObservation): DeviceObservation {
    return {
      ...mergeDeviceObservationLike(current, incoming),
      hwaddr: current.hwaddr,
    };
  }

  private mergePendingDeviceObservation(
    current: PendingDeviceObservation,
    incoming: PendingDeviceObservation,
  ): PendingDeviceObservation {
    return {
      ...mergeDeviceObservationLike(current, incoming),
      rawHwaddr: current.rawHwaddr ?? incoming.rawHwaddr,
    };
  }

  private async readBaselineMetadata(
    baseline: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<BaselineMetadataSnapshot> {
    const [groupsResult, clientsResult] = await this.instanceSessions.withActiveSession(
      baseline.id,
      locale,
      ({ connection, session }) =>
        Promise.all([this.pihole.listGroups(connection, session), this.pihole.listClients(connection, session)]),
    );
    const groupsById = new Map<number, string>();

    for (const group of groupsResult.groups) {
      if (group.id === null || group.name === null) {
        continue;
      }

      groupsById.set(group.id, group.name);
    }

    const clientsByHwaddr = new Map<string, BaselineClientMetadata>();

    for (const entry of clientsResult.clients) {
      if (!entry.client) {
        continue;
      }

      const client = normalizeHwaddr(entry.client);

      if (!isLikelyMacAddress(client)) {
        continue;
      }

      clientsByHwaddr.set(client, {
        comment: entry.comment ?? null,
        groupIds: sortNumberArray(entry.groups),
        groupNames: sortNumberArray(entry.groups)
          .map((groupId) => groupsById.get(groupId))
          .filter((groupName): groupName is string => Boolean(groupName)),
      });
    }

    return {
      clientsByHwaddr,
    };
  }

  private async loadSupportEntries(hwaddrs: string[]) {
    if (hwaddrs.length === 0) {
      return new Map<string, ClientSupportEntry>();
    }

    const items = await this.prisma.clientDevice.findMany({
      where: {
        hwaddr: {
          in: hwaddrs,
        },
      },
      select: {
        hwaddr: true,
        alias: true,
        tags: true,
      },
    });

    return new Map(
      items.map((item) => [
        normalizeHwaddr(item.hwaddr),
        {
          alias: item.alias ?? null,
          tags: normalizeClientTags(item.tags),
        },
      ]),
    );
  }

  private async loadAvailableTags() {
    const items = await this.prisma.clientDevice.findMany({
      select: {
        tags: true,
      },
    });

    return normalizeClientTags(items.flatMap((item) => item.tags)).sort((left, right) => compareStrings(left, right));
  }

  private buildListedClients(
    snapshots: InstanceDevicesSnapshot[],
    baselineInstanceId: string,
    baselineMetadata: Map<string, BaselineClientMetadata>,
    supportEntries: Map<string, ClientSupportEntry>,
  ): ClientsListResponse["items"] {
    const grouped = new Map<
      string,
      Array<{
        instance: ManagedInstanceRecord;
        device: DeviceObservation;
      }>
    >();

    for (const snapshot of snapshots) {
      for (const device of snapshot.devicesByHwaddr.values()) {
        const current = grouped.get(device.hwaddr) ?? [];
        current.push({
          instance: snapshot.instance,
          device,
        });
        grouped.set(device.hwaddr, current);
      }
    }

    const ipToHwaddr = new Map<string, string | null>();

    for (const [hwaddr, observations] of grouped.entries()) {
      for (const { device } of observations) {
        for (const ip of device.ips) {
          const current = ipToHwaddr.get(ip);

          if (current === undefined) {
            ipToHwaddr.set(ip, hwaddr);
            continue;
          }

          if (current !== hwaddr) {
            ipToHwaddr.set(ip, null);
          }
        }
      }
    }

    for (const snapshot of snapshots) {
      for (const unresolved of snapshot.unresolvedDevices) {
        const matchingHwaddrs = [
          ...new Set(
            unresolved.ips
              .map((ip) => ipToHwaddr.get(ip))
              .filter((hwaddr): hwaddr is string => typeof hwaddr === "string" && hwaddr.length > 0),
          ),
        ];

        if (matchingHwaddrs.length !== 1) {
          continue;
        }

        const resolvedHwaddr = matchingHwaddrs[0];

        if (!resolvedHwaddr) {
          continue;
        }

        const current = grouped.get(resolvedHwaddr) ?? [];
        const existingIndex = current.findIndex(({ instance }) => instance.id === snapshot.instance.id);
        const resolvedObservation: DeviceObservation = {
          hwaddr: resolvedHwaddr,
          macVendor: unresolved.macVendor,
          ips: unresolved.ips,
          firstSeen: unresolved.firstSeen,
          lastQuery: unresolved.lastQuery,
          numQueries: unresolved.numQueries,
        };

        if (existingIndex >= 0) {
          const existing = current[existingIndex];

          if (existing) {
            current[existingIndex] = {
              instance: existing.instance,
              device: this.mergeDeviceObservation(existing.device, resolvedObservation),
            };
          }
        } else {
          current.push({
            instance: snapshot.instance,
            device: resolvedObservation,
          });
        }

        grouped.set(resolvedHwaddr, current);
      }
    }

    const items: ClientsListResponse["items"] = [];

    for (const [hwaddr, observations] of grouped.entries()) {
      const sortedObservations = [...observations].sort((left, right) => {
        if (left.instance.id === baselineInstanceId && right.instance.id !== baselineInstanceId) {
          return -1;
        }

        if (left.instance.id !== baselineInstanceId && right.instance.id === baselineInstanceId) {
          return 1;
        }

        return left.instance.name.localeCompare(right.instance.name);
      });
      const visibleInInstances = sortInstanceSources(
        sortedObservations.map(({ instance }) => this.toSourceSummary(instance)),
        baselineInstanceId,
      );
      const instanceDetails = sortInstanceSources(
        sortedObservations.map(({ instance, device }) => ({
          ...this.toSourceSummary(instance),
          ips: device.ips,
          firstSeen: this.toIsoTimestamp(device.firstSeen),
          lastQuery: this.toIsoTimestamp(device.lastQuery),
          numQueries: device.numQueries,
        })),
        baselineInstanceId,
      );
      const preferred = sortedObservations[0];

      if (!preferred) {
        continue;
      }

      const metadata = baselineMetadata.get(hwaddr) ?? null;
      const support = supportEntries.get(hwaddr) ?? null;
      const ips = normalizeStringArray(sortedObservations.flatMap(({ device }) => device.ips));
      const firstSeen = sortedObservations.reduce<number | null>(
        (current, { device }) =>
          current === null
            ? device.firstSeen
            : device.firstSeen === null
              ? current
              : Math.min(current, device.firstSeen),
        null,
      );
      const lastQuery = sortedObservations.reduce<number | null>(
        (current, { device }) =>
          current === null
            ? device.lastQuery
            : device.lastQuery === null
              ? current
              : Math.max(current, device.lastQuery),
        null,
      );
      const numQueries = sortedObservations.reduce((total, { device }) => total + device.numQueries, 0);
      const macVendor =
        preferred.device.macVendor ??
        sortedObservations.find(({ device }) => device.macVendor !== null)?.device.macVendor ??
        null;

      items.push({
        hwaddr,
        alias: support?.alias ?? null,
        macVendor,
        ips,
        tags: support?.tags ?? [],
        instance: this.toSourceSummary(preferred.instance),
        visibleInInstances,
        instanceDetails,
        firstSeen: this.toIsoTimestamp(firstSeen),
        lastQuery: this.toIsoTimestamp(lastQuery),
        numQueries,
        comment: metadata?.comment ?? null,
        groupIds: metadata?.groupIds ?? [],
        groupNames: metadata?.groupNames ?? [],
      });
    }

    return items;
  }

  private async persistRequestedSupportMetadata(
    clients: string[],
    alias: string | undefined,
    tags: string[] | undefined,
  ) {
    if ((alias === undefined && tags === undefined) || clients.length === 0) {
      return;
    }

    const normalizedAlias = alias === undefined ? undefined : alias.length > 0 ? alias : null;
    const normalizedTags = tags === undefined ? undefined : normalizeClientTags(tags);

    await this.prisma.$transaction(
      clients.map((client) =>
        this.prisma.clientDevice.upsert({
          where: {
            hwaddr: client,
          },
          update: {
            ...(alias !== undefined ? { alias: normalizedAlias } : {}),
            ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
          },
          create: {
            hwaddr: client,
            ...(alias !== undefined ? { alias: normalizedAlias } : {}),
            ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
          },
        }),
      ),
    );
  }

  private async persistSupportEntries(
    items: ClientsListResponse["items"],
    supportEntries: Map<string, ClientSupportEntry>,
  ) {
    if (items.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.clientDevice.upsert({
          where: {
            hwaddr: item.hwaddr,
          },
          update: {
            alias: supportEntries.get(item.hwaddr)?.alias ?? null,
            macVendor: item.macVendor,
            ips: item.ips,
            tags: supportEntries.get(item.hwaddr)?.tags ?? [],
          },
          create: {
            hwaddr: item.hwaddr,
            alias: supportEntries.get(item.hwaddr)?.alias ?? null,
            macVendor: item.macVendor,
            ips: item.ips,
            tags: supportEntries.get(item.hwaddr)?.tags ?? [],
          },
        }),
      ),
    );
  }

  private async readBaselineGroups(
    instances: ManagedInstanceRecord[],
    requestedGroupIds: number[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const groupsResult = await this.instanceSessions.withActiveSession(baseline.id, locale, ({ connection, session }) =>
      this.pihole.listGroups(connection, session),
    );
    const groupsById = new Map<number, ManagedGroupRecord>();

    for (const group of groupsResult.groups) {
      if (group.id === null || group.name === null) {
        continue;
      }

      groupsById.set(group.id, {
        id: group.id,
        name: group.name,
      });
    }

    return requestedGroupIds.map((groupId) => {
      const group = groupsById.get(groupId);

      if (!group) {
        throw new BadRequestException(translateApi(locale, "clients.groupIdNotFound", { id: `${groupId}` }));
      }

      return group;
    });
  }

  private async applyClientsToInstance(
    instance: ManagedInstanceRecord,
    clients: string[],
    baselineGroups: ManagedGroupRecord[] | null,
    requestedComment: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const snapshot = await this.readInstanceApplySnapshot(instance, locale);
    const targetGroupIds =
      baselineGroups === null
        ? null
        : baselineGroups
            .map((group) => snapshot.groupsByName.get(group.name)?.id ?? null)
            .filter((groupId): groupId is number => groupId !== null);

    if (baselineGroups !== null) {
      const missingGroups = baselineGroups
        .filter((group) => !snapshot.groupsByName.has(group.name))
        .map((group) => group.name);

      if (missingGroups.length > 0) {
        throw new BadRequestException(
          translateApi(locale, "clients.instanceMissingGroups", {
            instance: instance.name,
            groups: missingGroups.join(", "),
          }),
        );
      }
    }

    await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
      for (const client of clients) {
        const current = snapshot.clientsByHwaddr.get(client) ?? null;
        const nextGroups = targetGroupIds ?? (current ? sortNumberArray(current.groups) : []);
        const commentToApply = requestedComment ?? current?.comment ?? "";
        const currentGroups = current ? sortNumberArray(current.groups) : [];

        if (current && areNumberArraysEqual(currentGroups, nextGroups) && (current.comment ?? "") === commentToApply) {
          continue;
        }

        const result = current
          ? await this.pihole.updateClient(connection, session, current.client, {
              comment: commentToApply,
              groups: nextGroups,
            })
          : await this.pihole.createClients(connection, session, {
              clients: [client],
              comment: commentToApply,
              groups: nextGroups,
            });

        this.assertClientMutationSucceeded(result);
      }
    });
  }

  private async readInstanceApplySnapshot(
    instance: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): Promise<InstanceApplySnapshot> {
    const [groupsResult, clientsResult] = await this.instanceSessions.withActiveSession(
      instance.id,
      locale,
      ({ connection, session }) =>
        Promise.all([this.pihole.listGroups(connection, session), this.pihole.listClients(connection, session)]),
    );
    const groupsByName = new Map<string, ManagedGroupRecord>();

    for (const group of groupsResult.groups) {
      const normalized = this.toManagedGroupRecord(group, instance, locale);
      groupsByName.set(normalized.name, normalized);
    }

    const clientsByHwaddr = new Map<string, ManagedClientRecord>();

    for (const client of clientsResult.clients) {
      const normalized = this.toManagedClientRecord(client);

      if (!normalized) {
        continue;
      }

      clientsByHwaddr.set(normalized.client, normalized);
    }

    return {
      groupsByName,
      clientsByHwaddr,
    };
  }

  private toManagedGroupRecord(
    group: PiholeManagedGroupEntry,
    instance: ManagedInstanceRecord,
    locale: ReturnType<typeof getRequestLocale>,
  ): ManagedGroupRecord {
    if (group.id === null || group.name === null) {
      throw new BadGatewayException(
        translateApi(locale, "pihole.invalidResponse", {
          baseUrl: instance.baseUrl,
          path: "/groups",
        }),
      );
    }

    return {
      id: group.id,
      name: group.name,
    };
  }

  private toManagedClientRecord(client: PiholeManagedClientEntry): ManagedClientRecord | null {
    if (!client.client) {
      return null;
    }

    const normalizedClient = normalizeHwaddr(client.client);

    if (!isLikelyMacAddress(normalizedClient)) {
      return null;
    }

    return {
      client: normalizedClient,
      comment: client.comment ?? null,
      groups: sortNumberArray(client.groups),
    };
  }

  private async readBaselineSyncSource(baseline: ManagedInstanceRecord, locale: ReturnType<typeof getRequestLocale>) {
    const [groupsResult, clientsResult] = await this.instanceSessions.withActiveSession(
      baseline.id,
      locale,
      ({ connection, session }) =>
        Promise.all([this.pihole.listGroups(connection, session), this.pihole.listClients(connection, session)]),
    );
    const groupsById = new Map<number, string>();

    for (const group of groupsResult.groups) {
      if (group.id === null || group.name === null) {
        continue;
      }

      groupsById.set(group.id, group.name);
    }

    return clientsResult.clients
      .map((client) => {
        const normalized = this.toManagedClientRecord(client);

        if (!normalized) {
          return null;
        }

        const groupNames = normalized.groups.map((groupId) => {
          const groupName = groupsById.get(groupId);

          if (!groupName) {
            throw new BadGatewayException(
              translateApi(locale, "pihole.invalidResponse", {
                baseUrl: baseline.baseUrl,
                path: "/clients",
              }),
            );
          }

          return groupName;
        });

        return {
          client: normalized.client,
          comment: normalized.comment,
          groupNames,
        };
      })
      .filter((item): item is { client: string; comment: string | null; groupNames: string[] } => item !== null);
  }

  private async syncClientsToInstance(
    instance: ManagedInstanceRecord,
    sourceClients: Array<{ client: string; comment: string | null; groupNames: string[] }>,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    const snapshot = await this.readInstanceApplySnapshot(instance, locale);

    await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
      for (const sourceClient of sourceClients) {
        const missingGroups = sourceClient.groupNames.filter((groupName) => !snapshot.groupsByName.has(groupName));

        if (missingGroups.length > 0) {
          throw new BadRequestException(
            translateApi(locale, "clients.instanceMissingGroups", {
              instance: instance.name,
              groups: missingGroups.join(", "),
            }),
          );
        }

        const targetGroupIds = sourceClient.groupNames
          .map((groupName) => snapshot.groupsByName.get(groupName)?.id ?? null)
          .filter((groupId): groupId is number => groupId !== null);
        const current = snapshot.clientsByHwaddr.get(sourceClient.client) ?? null;
        const nextComment = sourceClient.comment ?? "";
        const currentGroups = current ? sortNumberArray(current.groups) : [];

        if (
          current &&
          areNumberArraysEqual(currentGroups, sortNumberArray(targetGroupIds)) &&
          (current.comment ?? "") === nextComment
        ) {
          continue;
        }

        const result = current
          ? await this.pihole.updateClient(connection, session, current.client, {
              comment: nextComment,
              groups: targetGroupIds,
            })
          : await this.pihole.createClients(connection, session, {
              clients: [sourceClient.client],
              comment: nextComment,
              groups: targetGroupIds,
            });

        this.assertClientMutationSucceeded(result);
      }
    });
  }

  private buildMutationResponse(
    totalInstances: number,
    successfulInstances: ClientsMutationInstanceSource[],
    failedInstances: ClientsMutationInstanceFailure[],
  ): ClientsMutationResponse {
    return {
      status: failedInstances.length > 0 ? "partial" : "success",
      summary: {
        totalInstances,
        successfulCount: successfulInstances.length,
        failedCount: failedInstances.length,
      },
      successfulInstances,
      failedInstances,
    };
  }

  private assertClientMutationSucceeded(result: PiholeClientMutationResult) {
    const firstError = result.processed.errors.find(
      (item) => (item.message?.trim().length ?? 0) > 0 || (item.item?.trim().length ?? 0) > 0,
    );

    if (!firstError) {
      return;
    }

    throw new PiholeRequestError(
      502,
      firstError.message ?? firstError.item ?? "Pi-hole rejected the client operation.",
      "pihole_response_error",
      result,
    );
  }

  private toSourceSummary(instance: ManagedInstanceRecord): ClientsMutationInstanceSource {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
    };
  }

  private mapInstanceFailure(
    instance: ManagedInstanceRecord,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): ClientsMutationInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        ...this.toSourceSummary(instance),
        kind: error.kind,
        message: this.resolveFailureMessage(instance, error, locale),
      };
    }

    return {
      ...this.toSourceSummary(instance),
      kind: "unknown",
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private resolveFailureMessage(
    instance: ManagedInstanceRecord,
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
      case "pihole_response_error":
        return translateApi(locale, "clients.operationRejected", { baseUrl });
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }

  private toIsoTimestamp(value: number | null) {
    return value === null ? null : new Date(value * 1000).toISOString();
  }
}
