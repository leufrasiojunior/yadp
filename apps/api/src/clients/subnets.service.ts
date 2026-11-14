import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeService } from "../pihole/pihole.service";
import type { PiholeManagedClientEntry } from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import type { ApplySubnetDto, SubnetPlanDto } from "./dto/subnet-plan.dto";
import { normalizeSubnet } from "./subnet-validation";
import type {
  SubnetApplyResponse,
  SubnetListResponse,
  SubnetPlan,
  SubnetState,
  SubnetTargetPlan,
} from "./subnets.types";
import { createHash } from "node:crypto";

type Instance = { id: string; name: string; baseUrl: string };
type Snapshot = { clients: Map<string, PiholeManagedClientEntry>; groups: Map<string, number> };

@Injectable()
export class SubnetsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly sessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private subnet(raw: string) {
    try {
      return normalizeSubnet(raw);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid subnet.");
    }
  }

  private async instances(ids?: string[]): Promise<Instance[]> {
    const instances = await this.prisma.instance.findMany({
      where: { syncEnabled: true },
      orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
      select: { id: true, name: true, baseUrl: true },
    });
    if (!instances.length) throw new BadRequestException("No sync-enabled Pi-hole instances.");
    if (ids?.some((id) => !instances.some((instance) => instance.id === id))) {
      throw new BadRequestException("Unknown or disabled target instance.");
    }
    return ids ? instances.filter((instance) => ids.includes(instance.id)) : instances;
  }

  private async snapshot(instance: Instance, request: Request): Promise<Snapshot> {
    const [clients, groups] = await this.sessions.withActiveSession(
      instance.id,
      getRequestLocale(request),
      ({ connection, session }) =>
        Promise.all([this.pihole.listClients(connection, session), this.pihole.listGroups(connection, session)]),
    );
    const bySubnet = new Map<string, PiholeManagedClientEntry>();
    for (const entry of clients.clients) {
      if (!entry.client?.includes("/")) continue;
      let key: string;
      try {
        key = normalizeSubnet(entry.client);
      } catch {
        continue;
      }
      if (bySubnet.has(key))
        throw new BadGatewayException(`Duplicate subnet entries for ${key}. Review this Pi-hole first.`);
      bySubnet.set(key, entry);
    }
    const byName = new Map<string, number>();
    for (const group of groups.groups) {
      if (group.name === null || group.id === null || byName.has(group.name)) {
        throw new BadGatewayException("Invalid or ambiguous Pi-hole groups.");
      }
      byName.set(group.name, group.id);
    }
    return { clients: bySubnet, groups: byName };
  }

  private state(entry: PiholeManagedClientEntry | undefined, snapshot: Snapshot): SubnetState | null {
    if (!entry) return null;
    const names = new Map([...snapshot.groups].map(([name, id]) => [id, name]));
    const groups = entry.groups
      .map((id) => {
        const name = names.get(id);
        if (name === undefined) throw new BadGatewayException("Subnet references an unknown Pi-hole group.");
        return name;
      })
      .sort();
    return { groups, comment: entry.comment ?? "" };
  }

  async list(request: Request): Promise<SubnetListResponse> {
    const instances = await this.instances();
    const items = new Map<string, SubnetListResponse["items"][number]>();
    const unavailableInstances: SubnetListResponse["unavailableInstances"] = [];
    await Promise.all(
      instances.map(async (instance) => {
        try {
          const snapshot = await this.snapshot(instance, request);
          const rows = [...snapshot.clients].map(([client, entry]) => ({ client, state: this.state(entry, snapshot) }));
          for (const { client, state } of rows) {
            if (!state) continue;
            const item = items.get(client) ?? { client, instances: [] };
            item.instances.push({ instanceId: instance.id, instanceName: instance.name, ...state });
            items.set(client, item);
          }
        } catch (error) {
          unavailableInstances.push({
            instanceId: instance.id,
            instanceName: instance.name,
            message: this.message(error),
          });
        }
      }),
    );
    return {
      items: [...items.values()]
        .sort((a, b) => a.client.localeCompare(b.client))
        .map((item) => ({
          ...item,
          instances: item.instances.sort((a, b) => a.instanceName.localeCompare(b.instanceName)),
        })),
      instances: instances.map((instance) => ({ instanceId: instance.id, instanceName: instance.name })),
      unavailableInstances,
    };
  }

  private async prepare(dto: SubnetPlanDto, request: Request) {
    const client = this.subnet(dto.client);
    const groups = [...new Set((dto.groups ?? []).map((name) => name.trim()))].sort();
    if (dto.operation === "save" && (!groups.length || groups.some((name) => !name))) {
      throw new BadRequestException("Select at least one group. Use Default for the default policy.");
    }
    const instances = await this.instances(dto.targetInstanceIds);
    const snapshots = new Map<string, Snapshot>();
    const targets: SubnetTargetPlan[] = [];
    for (const instance of instances) {
      const source = { instanceId: instance.id, instanceName: instance.name };
      try {
        const snapshot = await this.snapshot(instance, request);
        snapshots.set(instance.id, snapshot);
        const current = this.state(snapshot.clients.get(client), snapshot);
        if (dto.operation === "save" && groups.some((name) => !snapshot.groups.has(name))) {
          throw new BadRequestException(
            "One or more selected groups are missing on this instance. Synchronize groups first.",
          );
        }
        const desired =
          dto.operation === "delete" ? null : { groups, comment: dto.comment?.trim() ?? current?.comment ?? "" };
        const action =
          JSON.stringify(current) === JSON.stringify(desired)
            ? "unchanged"
            : dto.operation === "delete"
              ? "delete"
              : current
                ? "update"
                : "create";
        targets.push({ ...source, action, current, desired });
      } catch (error) {
        targets.push({ ...source, action: "unavailable", current: null, desired: null, message: this.message(error) });
      }
    }
    // Include each instance's numeric group mapping and original client spelling.
    // A changed configuration requires a new preview rather than silently applying stale intent.
    const fingerprint = {
      client,
      operation: dto.operation,
      targets,
      mappings: instances.map((instance) => {
        const snapshot = snapshots.get(instance.id);
        return [instance.id, snapshot?.clients.get(client)?.client, [...(snapshot?.groups ?? [])].sort()];
      }),
    };
    const previewToken = createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex");
    return {
      plan: { client, operation: dto.operation, targets, previewToken } satisfies SubnetPlan,
      instances,
      snapshots,
    };
  }

  async preview(dto: SubnetPlanDto, request: Request): Promise<SubnetPlan> {
    return (await this.prepare(dto, request)).plan;
  }

  async apply(dto: ApplySubnetDto, request: Request): Promise<SubnetApplyResponse> {
    const { plan, instances, snapshots } = await this.prepare(dto, request);
    if (plan.previewToken !== dto.previewToken)
      throw new ConflictException("Configuration changed. Review a fresh preview before applying.");
    const successfulInstances: SubnetApplyResponse["successfulInstances"] = [];
    const failedInstances: SubnetApplyResponse["failedInstances"] = [];
    for (const target of plan.targets) {
      const source = { instanceId: target.instanceId, instanceName: target.instanceName };
      try {
        if (target.action === "unavailable") throw new BadGatewayException(target.message);
        if (target.action !== "unchanged") {
          const snapshot = snapshots.get(target.instanceId);
          if (!snapshot) throw new BadGatewayException("Pi-hole snapshot unavailable.");
          const existing = snapshot.clients.get(plan.client);
          await this.sessions.withActiveSession(
            target.instanceId,
            getRequestLocale(request),
            async ({ connection, session }) => {
              if (target.action === "delete") {
                await this.pihole.deleteClient(connection, session, existing?.client ?? plan.client);
              } else {
                const config = {
                  groups: (target.desired?.groups ?? []).map((name) => snapshot.groups.get(name)!),
                  comment: target.desired?.comment ?? "",
                };
                const result = existing
                  ? await this.pihole.updateClient(connection, session, existing.client ?? plan.client, config)
                  : await this.pihole.createClients(connection, session, { clients: [plan.client], ...config });
                if (result.processed.errors.length)
                  throw new BadGatewayException("Pi-hole rejected the subnet operation.");
              }
            },
          );
          const instance = instances.find((item) => item.id === target.instanceId)!;
          const actual = await this.snapshot(instance, request);
          if (JSON.stringify(this.state(actual.clients.get(plan.client), actual)) !== JSON.stringify(target.desired)) {
            throw new BadGatewayException("Subnet read-back verification failed. Refresh before retrying.");
          }
        }
        successfulInstances.push(source);
      } catch (error) {
        failedInstances.push({ ...source, message: this.message(error) });
      }
    }
    const response: SubnetApplyResponse = {
      status: failedInstances.length ? "partial" : "success",
      successfulInstances,
      failedInstances,
    };
    await this.audit.record({
      action: `clients.subnet.${dto.operation}`,
      actorType: "session",
      ipAddress: getRequestIp(request),
      targetType: "client",
      targetId: plan.client,
      result: failedInstances.length ? "FAILURE" : "SUCCESS",
      details: {
        operation: dto.operation,
        groups: dto.groups ?? [],
        comment: dto.comment ?? null,
        successfulInstances,
        failedInstances,
      } satisfies Prisma.InputJsonObject,
    });
    return response;
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : "Pi-hole operation failed.";
  }
}
