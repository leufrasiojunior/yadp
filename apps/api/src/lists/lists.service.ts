import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type { PiholeManagedInstanceSummary, PiholeManagedListEntry } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { BatchDeleteListsDto } from "./dto/batch-delete-lists.dto";
import type { CreateListDto } from "./dto/create-list.dto";
import type { SyncListsDto } from "./dto/sync-lists.dto";
import type { UpdateListDto } from "./dto/update-list.dto";
import type {
  ListItem,
  ListsListResponse,
  ListsMutationInstanceFailure,
  ListsMutationInstanceSource,
  ListsMutationResponse,
} from "./lists.types";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedListRecord = Omit<ListItem, "origin" | "sync">;

type InstanceListsSnapshot = {
  instance: ManagedInstanceRecord;
  listsByAddress: Map<string, ManagedListRecord>;
};

type ListSnapshotsResult = {
  snapshots: InstanceListsSnapshot[];
  unavailableInstances: ListsMutationInstanceFailure[];
};

@Injectable()
export class ListsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listLists(request: Request): Promise<ListsListResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots, unavailableInstances } = await this.prepareSnapshotsForList(instances, request);
    const consolidatedItems = this.buildListedLists(snapshots, baseline.id);

    // Persist discovered lists to database
    await Promise.all(
      consolidatedItems.map((item) =>
        this.prisma.managedList.upsert({
          where: { address: item.address },
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

    return {
      items: consolidatedItems,
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
      where: { address: body.address },
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
      },
    });

    return results;
  }

  async updateList(address: string, body: UpdateListDto, request: Request): Promise<ListsMutationResponse> {
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
        where: { address },
        data: {
          comment: body.comment,
          type: body.type,
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
            type: body.type,
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
        body: body as unknown as Prisma.InputJsonValue,
        summary: results.summary,
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

    const addresses = body.items.map((item) => item.item);
    await this.prisma.managedList.deleteMany({
      where: { address: { in: addresses } },
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

      const finalListData = listData;

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
    for (const s of snapshots) for (const key of s.listsByAddress.keys()) allKeys.add(key);

    const results: ListsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    for (const instance of instances) {
      const snapshot = snapshots.find((s) => s.instance.id === instance.id);
      const missingKeys = [...allKeys].filter((key) => !snapshot?.listsByAddress.has(key));

      if (missingKeys.length === 0) {
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
        continue;
      }

      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const key of missingKeys) {
            const sourceSnap =
              snapshots.find((s) => s.instance.isBaseline && s.listsByAddress.has(key)) ||
              snapshots.find((s) => s.listsByAddress.has(key));
            const data = sourceSnap?.listsByAddress.get(key);
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
      select: { id: true, name: true, baseUrl: true, isBaseline: true },
      orderBy: { name: "asc" },
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

            const listsByAddress = new Map<string, ManagedListRecord>();
            for (const entry of [...allowResult.lists, ...blockResult.lists]) {
              if (entry.address && entry.type) {
                const key = `${entry.address}-${entry.type}`;
                listsByAddress.set(key, this.normalizeManagedList(entry));
              }
            }
            snapshots.push({ instance, listsByAddress });
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
    const allAddresses = new Set<string>();
    for (const s of snapshots) for (const addr of s.listsByAddress.keys()) allAddresses.add(addr);

    const items: ListItem[] = [];
    for (const address of allAddresses) {
      const sourceInstances: ListsMutationInstanceSource[] = [];
      const missingInstances: ListsMutationInstanceSource[] = [];
      let referenceRecord: ManagedListRecord | null = null;
      let originInstanceId = "";
      let originInstanceName = "";

      // Prefer baseline for the UI "record"
      const baselineSnap = snapshots.find((s) => s.instance.id === baselineId);
      const baselineRecord = baselineSnap?.listsByAddress.get(address);
      if (baselineRecord) {
        referenceRecord = baselineRecord;
        originInstanceId = baselineSnap.instance.id;
        originInstanceName = baselineSnap.instance.name;
      }

      for (const snapshot of snapshots) {
        const snapRecord = snapshot.listsByAddress.get(address);
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
    return items.sort((a, b) => a.address.localeCompare(b.address));
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
