import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { PiholeListType, PiholeManagedInstanceSummary, PiholeManagedListEntry } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { BatchDeleteListsDto } from "./dto/batch-delete-lists.dto";
import type { CreateListDto } from "./dto/create-list.dto";
import type { GetListsDto } from "./dto/get-lists.dto";
import type { SyncListsDto } from "./dto/sync-lists.dto";
import type { UpdateListDto } from "./dto/update-list.dto";
import {
  DEFAULT_LISTS_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  DEFAULT_LISTS_SORT_DIRECTION as DEFAULT_SORT_DIRECTION,
  DEFAULT_LISTS_SORT_FIELD as DEFAULT_SORT_FIELD,
  type ListItem,
  type ListSortDirection,
  type ListSortField,
  type ListsListResponse,
  type ListsMutationInstanceFailure,
  type ListsMutationInstanceSource,
  type ListsMutationResponse,
} from "./lists.types";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedListRecord = Omit<ListItem, "origin" | "sync">;

type InstanceListsSnapshot = {
  instance: ManagedInstanceRecord;
  listsByKey: Map<string, ManagedListRecord>;
};

type ListSnapshotsResult = {
  snapshots: InstanceListsSnapshot[];
  unavailableInstances: ListsMutationInstanceFailure[];
};

function buildListKey(address: string, type: PiholeListType) {
  return `${address}-${type}`;
}

function matchesListSearch(item: ListItem, searchTerm: string) {
  const normalizedSearch = searchTerm.toLocaleLowerCase();
  return (
    item.address.toLocaleLowerCase().includes(normalizedSearch) ||
    item.type.toLocaleLowerCase().includes(normalizedSearch) ||
    (item.comment?.toLocaleLowerCase().includes(normalizedSearch) ?? false)
  );
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
}

function compareBoolean(left: boolean, right: boolean) {
  if (left === right) {
    return 0;
  }

  return left ? 1 : -1;
}

function compareNumberArrays(left: number[], right: number[]) {
  return left.join(",").localeCompare(right.join(","));
}

function sortListItems(items: ListItem[], sortBy: ListSortField, sortDirection: ListSortDirection) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let comparison = 0;

    switch (sortBy) {
      case "address":
        comparison = left.address.localeCompare(right.address, undefined, { sensitivity: "base" });
        break;
      case "type":
        comparison = left.type.localeCompare(right.type, undefined, { sensitivity: "base" });
        break;
      case "enabled":
        comparison = compareBoolean(left.enabled, right.enabled);
        break;
      case "comment":
        comparison = compareNullableStrings(left.comment, right.comment);
        break;
      case "group":
        comparison = compareNumberArrays(left.groups, right.groups);
        break;
    }

    if (comparison === 0) {
      comparison =
        left.address.localeCompare(right.address, undefined, { sensitivity: "base" }) ||
        left.type.localeCompare(right.type, undefined, { sensitivity: "base" });
    }

    return comparison * multiplier;
  });
}

@Injectable()
export class ListsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listLists(query: GetListsDto, request: Request): Promise<ListsListResponse> {
    const locale = getRequestLocale(request);
    const searchTerm = query.search?.trim() ?? "";
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots, unavailableInstances } = await this.prepareSnapshotsForList(instances, request);
    const consolidatedItems = this.buildListedLists(snapshots, baseline.id);
    const filteredItems =
      searchTerm.length > 0
        ? consolidatedItems.filter((item) => matchesListSearch(item, searchTerm))
        : consolidatedItems;
    const sortedItems = sortListItems(filteredItems, query.sortBy, query.sortDirection);

    // Persist discovered lists to database
    await Promise.all(
      consolidatedItems.map((item) =>
        this.prisma.managedList.upsert({
          where: {
            address_type: {
              address: item.address,
              type: item.type,
            },
          },
          update: {
            comment: item.comment,
            type: item.type,
            groups: item.groups,
            enabled: item.enabled,
          },
          create: {
            address: item.address,
            comment: item.comment,
            type: item.type,
            groups: item.groups,
            enabled: item.enabled,
          },
        }),
      ),
    );

    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalItems = sortedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(query.page ?? 1, totalPages);
    const startIndex = (page - 1) * pageSize;

    return {
      items: sortedItems.slice(startIndex, startIndex + pageSize),
      summary: {
        totalItems: consolidatedItems.length,
      },
      pagination: {
        page,
        pageSize,
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

  async getList(type: PiholeListType, address: string, request: Request): Promise<ListItem> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots } = await this.prepareSnapshotsForList(instances, request);
    const item = this.buildListedLists(snapshots, baseline.id).find(
      (candidate) => candidate.address === address && candidate.type === type,
    );

    if (!item) {
      throw new NotFoundException("List not found.");
    }

    return item;
  }

  async createList(body: CreateListDto, request: Request): Promise<ListsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const results: ListsMutationResponse = {
      status: "success",
      summary: {
        totalInstances: instances.length,
        successfulCount: 0,
        failedCount: 0,
      },
      successfulInstances: [],
      failedInstances: [],
    };

    const finalComment = body.comment?.trim() || translateApi(locale, "lists.defaultComment");

    await this.prisma.managedList.upsert({
      where: {
        address_type: {
          address: body.address,
          type: body.type,
        },
      },
      update: {
        comment: finalComment,
        type: body.type,
        groups: body.groups,
        enabled: body.enabled ?? true,
      },
      create: {
        address: body.address,
        comment: finalComment,
        type: body.type,
        groups: body.groups,
        enabled: body.enabled ?? true,
      },
    });

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          await this.pihole.createLists(connection, session, {
            address: body.address,
            comment: finalComment,
            type: body.type,
            groups: body.groups,
            enabled: body.enabled ?? true,
          });
        });

        results.successfulInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
        });
        results.summary.successfulCount++;
      } catch (error) {
        const kind = error instanceof PiholeRequestError ? error.kind : "unknown";
        results.failedInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
          kind,
          message: error instanceof Error ? error.message : String(error),
        });
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    await this.audit.record({
      action: "lists.create",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "list",
      targetId: body.address,
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        body: body as unknown as Prisma.InputJsonValue,
        summary: results.summary,
        failedInstances: results.failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  async updateList(
    type: PiholeListType,
    address: string,
    body: UpdateListDto,
    request: Request,
  ): Promise<ListsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const results: ListsMutationResponse = {
      status: "success",
      summary: {
        totalInstances: instances.length,
        successfulCount: 0,
        failedCount: 0,
      },
      successfulInstances: [],
      failedInstances: [],
    };

    await this.prisma.managedList
      .update({
        where: {
          address_type: {
            address,
            type,
          },
        },
        data: {
          comment: body.comment,
          type,
          groups: body.groups,
          enabled: body.enabled,
        },
      })
      .catch(() => {
        // Ignore if doesn't exist in DB yet, source of truth is Pi-hole
      });

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          await this.pihole.updateList(connection, session, address, {
            comment: body.comment,
            type,
            groups: body.groups,
            enabled: body.enabled,
          });
        });

        results.successfulInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
        });
        results.summary.successfulCount++;
      } catch (error) {
        const kind = error instanceof PiholeRequestError ? error.kind : "unknown";
        results.failedInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
          kind,
          message: error instanceof Error ? error.message : String(error),
        });
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    await this.audit.record({
      action: "lists.update",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "list",
      targetId: address,
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        address,
        type,
        body: body as unknown as Prisma.InputJsonValue,
        summary: results.summary,
        failedInstances: results.failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  async batchDelete(body: BatchDeleteListsDto, request: Request): Promise<ListsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const results: ListsMutationResponse = {
      status: "success",
      summary: {
        totalInstances: instances.length,
        successfulCount: 0,
        failedCount: 0,
      },
      successfulInstances: [],
      failedInstances: [],
    };

    await this.prisma.managedList.deleteMany({
      where: {
        OR: body.items.map((item) => ({
          address: item.item,
          type: item.type,
        })),
      },
    });

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const item of body.items) {
            await this.pihole.deleteList(connection, session, item.item, item.type);
          }
        });

        results.successfulInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
        });
        results.summary.successfulCount++;
      } catch (error) {
        const kind = error instanceof PiholeRequestError ? error.kind : "unknown";
        results.failedInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
          kind,
          message: error instanceof Error ? error.message : String(error),
        });
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    await this.audit.record({
      action: "lists.batchDelete",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "list",
      targetId: "batch",
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        items: body.items as unknown as Prisma.InputJsonValue,
        summary: results.summary,
        failedInstances: results.failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  async syncLists(body: SyncListsDto, request: Request): Promise<ListsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();

    if (body.address && body.type && body.sourceInstanceId && body.targetInstanceIds) {
      // Single list sync
      const targetInstances = instances.filter((i) => body.targetInstanceIds?.includes(i.id));
      const results: ListsMutationResponse = {
        status: "success",
        summary: { totalInstances: targetInstances.length, successfulCount: 0, failedCount: 0 },
        successfulInstances: [],
        failedInstances: [],
      };

      let listData: ManagedListRecord | null = null;
      try {
        await this.instanceSessions.withActiveSession(
          body.sourceInstanceId,
          locale,
          async ({ connection, session }) => {
            const result = await this.pihole.listLists(connection, session, body.address, body.type as PiholeListType);
            const entry = result.lists.find((l) => l.address === body.address && l.type === body.type);
            if (entry) {
              listData = this.normalizeManagedList(entry);
            }
          },
        );
      } catch (error) {
        throw new BadRequestException(
          `Failed to read from source instance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!listData) throw new BadRequestException("List not found on source instance");

      const finalListData = listData as ManagedListRecord;

      for (const instance of targetInstances) {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            await this.pihole.createLists(connection, session, {
              address: finalListData.address,
              comment: finalListData.comment,
              type: finalListData.type,
              groups: finalListData.groups,
              enabled: finalListData.enabled,
            });
          });
          results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
          results.summary.successfulCount++;
        } catch (error) {
          results.failedInstances.push({
            instanceId: instance.id,
            instanceName: instance.name,
            kind: error instanceof PiholeRequestError ? error.kind : "unknown",
            message: error instanceof Error ? error.message : String(error),
          });
          results.summary.failedCount++;
          results.status = "partial";
        }
      }
      return results;
    }
    // Bulk sync (N to N logic)
    const { snapshots } = await this.prepareSnapshotsForList(instances, request);
    const allKeys = new Set<string>();
    for (const snapshot of snapshots) {
      for (const key of snapshot.listsByKey.keys()) {
        allKeys.add(key);
      }
    }

    const results: ListsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    for (const instance of instances) {
      const snapshot = snapshots.find((s) => s.instance.id === instance.id);
      const missingKeys = [...allKeys].filter((key) => !snapshot?.listsByKey.has(key));

      if (missingKeys.length === 0) {
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
        continue;
      }

      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const key of missingKeys) {
            const sourceSnap =
              snapshots.find((s) => s.instance.isBaseline && s.listsByKey.has(key)) ||
              snapshots.find((s) => s.listsByKey.has(key));
            const data = sourceSnap?.listsByKey.get(key);
            if (data) {
              await this.pihole.createLists(connection, session, {
                address: data.address,
                comment: data.comment,
                type: data.type,
                groups: data.groups,
                enabled: data.enabled,
              });
            }
          }
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push({
          instanceId: instance.id,
          instanceName: instance.name,
          kind: error instanceof PiholeRequestError ? error.kind : "unknown",
          message: error instanceof Error ? error.message : String(error),
        });
        results.summary.failedCount++;
        results.status = "partial";
      }
    }
    return results;
  }

  private async loadManagedInstances(): Promise<ManagedInstanceRecord[]> {
    const instances = await this.prisma.instance.findMany({
      where: { syncEnabled: true },
      select: { id: true, name: true, baseUrl: true, isBaseline: true },
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
    });
    return instances.map((i) => ({ ...i }));
  }

  private async prepareSnapshotsForList(
    instances: ManagedInstanceRecord[],
    request: Request,
  ): Promise<ListSnapshotsResult> {
    const locale = getRequestLocale(request);
    const snapshots: InstanceListsSnapshot[] = [];
    const unavailableInstances: ListsMutationInstanceFailure[] = [];

    await Promise.all(
      instances.map(async (instance) => {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            const [allowResult, blockResult] = await Promise.all([
              this.pihole.listLists(connection, session, undefined, "allow"),
              this.pihole.listLists(connection, session, undefined, "block"),
            ]);

            const listsByKey = new Map<string, ManagedListRecord>();
            for (const entry of [...allowResult.lists, ...blockResult.lists]) {
              if (entry.address && entry.type) {
                const key = buildListKey(entry.address, entry.type);
                listsByKey.set(key, this.normalizeManagedList(entry));
              }
            }
            snapshots.push({ instance, listsByKey });
          });
        } catch (error) {
          unavailableInstances.push({
            instanceId: instance.id,
            instanceName: instance.name,
            kind: error instanceof PiholeRequestError ? error.kind : "unknown",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    return { snapshots, unavailableInstances };
  }

  private buildListedLists(snapshots: InstanceListsSnapshot[], baselineId: string): ListItem[] {
    const allKeys = new Set<string>();
    for (const snapshot of snapshots) {
      for (const key of snapshot.listsByKey.keys()) {
        allKeys.add(key);
      }
    }

    const items: ListItem[] = [];
    for (const key of allKeys) {
      const sourceInstances: ListsMutationInstanceSource[] = [];
      const missingInstances: ListsMutationInstanceSource[] = [];
      let referenceRecord: ManagedListRecord | null = null;
      let originInstanceId = "";
      let originInstanceName = "";

      // Prefer baseline for the UI "record"
      const baselineSnap = snapshots.find((s) => s.instance.id === baselineId);
      const baselineRecord = baselineSnap?.listsByKey.get(key);
      if (baselineRecord && baselineSnap) {
        referenceRecord = baselineRecord;
        originInstanceId = baselineSnap.instance.id;
        originInstanceName = baselineSnap.instance.name;
      }

      for (const snapshot of snapshots) {
        const snapRecord = snapshot.listsByKey.get(key);
        if (snapRecord) {
          sourceInstances.push({ instanceId: snapshot.instance.id, instanceName: snapshot.instance.name });
          if (!referenceRecord) {
            referenceRecord = snapRecord;
            originInstanceId = snapshot.instance.id;
            originInstanceName = snapshot.instance.name;
          }
        } else {
          missingInstances.push({ instanceId: snapshot.instance.id, instanceName: snapshot.instance.name });
        }
      }

      if (referenceRecord) {
        items.push({
          ...referenceRecord,
          origin: { instanceId: originInstanceId, instanceName: originInstanceName },
          sync: { isFullySynced: missingInstances.length === 0, sourceInstances, missingInstances },
        });
      }
    }
    return sortListItems(items, DEFAULT_SORT_FIELD, DEFAULT_SORT_DIRECTION);
  }

  private normalizeManagedList(entry: PiholeManagedListEntry): ManagedListRecord {
    return {
      address: entry.address ?? "",
      comment: entry.comment,
      enabled: entry.enabled ?? false,
      groups: entry.groups,
      id: entry.id ?? 0,
      dateAdded: entry.dateAdded,
      dateModified: entry.dateModified,
      type: entry.type ?? "block",
      dateUpdated: entry.dateUpdated,
      number: entry.number,
      invalidDomains: entry.invalidDomains,
      abpEntries: entry.abpEntries,
      status: entry.status,
    };
  }
}
