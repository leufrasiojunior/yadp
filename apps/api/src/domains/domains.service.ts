import { BadRequestException, Inject, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeDomainMutationResult,
  PiholeDomainOperationKind,
  PiholeDomainOperationType,
  PiholeManagedInstanceSummary,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import {
  DEFAULT_DOMAIN_OPERATION_COMMENT,
  DEFAULT_DOMAINS_PAGE_SIZE,
  DEFAULT_DOMAINS_SORT_DIRECTION,
  DEFAULT_DOMAINS_SORT_FIELD,
  type DomainFilterValue,
  type DomainItem,
  type DomainOperationKind,
  type DomainOperationResponse,
  type DomainOperationType,
  type DomainPatternMode,
  type DomainScopeMode,
  type DomainSortDirection,
  type DomainSortField,
  type DomainsImportResponse,
  type DomainsInstanceFailure,
  type DomainsInstanceSource,
  type DomainsListResponse,
  type DomainsMutationResponse,
} from "./domains.types";
import { parseDomainEnabledValue, parseDomainGroupCell, parseDomainsCsv, serializeDomainsCsv } from "./domains-csv";
import type { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
import type { BatchDeleteDomainsDto } from "./dto/batch-delete-domains.dto";
import type { DomainItemParamsDto } from "./dto/domain-item-params.dto";
import type { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";
import type { GetDomainsDto } from "./dto/get-domains.dto";
import type { SyncDomainsDto } from "./dto/sync-domains.dto";
import type { UpdateDomainDto } from "./dto/update-domain.dto";

type ManagedInstanceRecord = PiholeManagedInstanceSummary & {
  isBaseline: boolean;
};

type ManagedDomainRecord = Omit<DomainItem, "origin" | "sync">;

type InstanceDomainsSnapshot = {
  instance: ManagedInstanceRecord;
  domainsByKey: Map<string, ManagedDomainRecord>;
};

type DomainSnapshotsResult = {
  snapshots: InstanceDomainsSnapshot[];
  unavailableInstances: DomainsInstanceFailure[];
};

type ListedDomainsData = {
  items: DomainItem[];
  summary: DomainsListResponse["summary"];
  source: DomainsListResponse["source"];
  unavailableInstances: DomainsInstanceFailure[];
};

type DomainImportRowInput = {
  domain: string;
  type: DomainOperationType;
  kind: DomainOperationKind;
  comment: string | null;
  enabled: boolean;
  groups: number[];
};

type GroupMappings = {
  idToName: Map<number, string>;
  normalizedNameToId: Map<string, number>;
};

type UploadedCsvFile = {
  buffer: Buffer;
};

function buildDomainKey(domain: string, type: string, kind: string) {
  return `${domain}-${type}-${kind}`;
}

function matchesDomainSearch(item: DomainItem, searchTerm: string) {
  const normalizedSearch = searchTerm.toLocaleLowerCase();
  return (
    item.domain.toLocaleLowerCase().includes(normalizedSearch) ||
    item.type.toLocaleLowerCase().includes(normalizedSearch) ||
    item.kind.toLocaleLowerCase().includes(normalizedSearch) ||
    (item.comment?.toLocaleLowerCase().includes(normalizedSearch) ?? false)
  );
}

function matchesDomainFilters(item: DomainItem, filters: DomainFilterValue[]) {
  const filterKey = `${item.kind}-${item.type}` as DomainFilterValue;
  return filters.includes(filterKey);
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

function sortDomainItems(items: DomainItem[], sortBy: DomainSortField, sortDirection: DomainSortDirection) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let comparison = 0;

    switch (sortBy) {
      case "domain":
        comparison = left.domain.localeCompare(right.domain, undefined, { sensitivity: "base" });
        break;
      case "type":
        comparison = left.type.localeCompare(right.type, undefined, { sensitivity: "base" });
        break;
      case "kind":
        comparison = left.kind.localeCompare(right.kind, undefined, { sensitivity: "base" });
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
        left.domain.localeCompare(right.domain, undefined, { sensitivity: "base" }) ||
        left.type.localeCompare(right.type, undefined, { sensitivity: "base" }) ||
        left.kind.localeCompare(right.kind, undefined, { sensitivity: "base" });
    }

    return comparison * multiplier;
  });
}

@Injectable()
export class DomainsService implements OnModuleInit {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.seedRegexFilters();
  }

  private async seedRegexFilters() {
    const filters = [
      {
        name: "Bloquear um nome exato com TLD específico",
        pattern: "(\\.|^)domain\\.com$",
        description: "Exemplo: matches google.com but not mygoogle.com",
      },
      {
        name: "Bloquear um nome exato com qualquer TLD",
        pattern: "(^|\\.)domain(\\.[a-z]{2,})+$",
        description: "Exemplo: matches google.com, google.net, google.org, etc.",
      },
    ];

    for (const filter of filters) {
      try {
        await this.prisma.regexFilter.upsert({
          where: { name: filter.name },
          update: { pattern: filter.pattern, description: filter.description },
          create: { name: filter.name, pattern: filter.pattern, description: filter.description },
        });
      } catch (error) {
        this.logger.error(`Failed to seed regex filter ${filter.name}`, error);
      }
    }
  }

  async listDomains(query: GetDomainsDto, request: Request): Promise<DomainsListResponse> {
    const listedData = await this.getListedDomainsData(query, request);
    const pageSize = query.pageSize ?? DEFAULT_DOMAINS_PAGE_SIZE;
    const totalItems = listedData.items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(query.page ?? 1, totalPages);
    const startIndex = (page - 1) * pageSize;

    return {
      items: listedData.items.slice(startIndex, startIndex + pageSize),
      summary: listedData.summary,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      source: listedData.source,
      unavailableInstances: listedData.unavailableInstances,
    };
  }

  async exportDomainsCsv(query: GetDomainsDto, request: Request) {
    const listedData = await this.getListedDomainsData(query, request);
    const groupMappings = await this.loadGroupMappings(getRequestLocale(request));
    const content = serializeDomainsCsv(listedData.items, (groupIds) =>
      groupIds.map((groupId) => groupMappings.idToName.get(groupId) ?? `id:${groupId}`),
    );

    return {
      filename: "domains.csv",
      content,
    };
  }

  async importDomainsCsv(file: UploadedCsvFile | undefined, request: Request): Promise<DomainsImportResponse> {
    const locale = getRequestLocale(request);

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("CSV file is required.");
    }

    let rows: ReturnType<typeof parseDomainsCsv>;
    try {
      rows = parseDomainsCsv(file.buffer.toString("utf8"));
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
    const groupMappings = await this.loadGroupMappings(locale);
    const listedData = await this.getListedDomainsData(
      {
        page: 1,
        pageSize: DEFAULT_DOMAINS_PAGE_SIZE,
        sortBy: DEFAULT_DOMAINS_SORT_FIELD,
        sortDirection: DEFAULT_DOMAINS_SORT_DIRECTION,
        search: "",
        filters: ["exact-allow", "regex-allow", "exact-deny", "regex-deny"],
      } as GetDomainsDto,
      request,
    );
    const existingItemsByKey = new Map(
      listedData.items.map((item) => [buildDomainKey(item.domain, item.type, item.kind), item] as const),
    );

    const results: DomainsImportResponse = {
      status: "success",
      summary: {
        totalRows: rows.length,
        createdCount: 0,
        updatedCount: 0,
        invalidCount: 0,
      },
      errors: [],
    };

    for (const row of rows) {
      try {
        const normalizedRow = this.normalizeImportedRow(row, groupMappings);
        const key = buildDomainKey(normalizedRow.domain, normalizedRow.type, normalizedRow.kind);
        const existingItem = existingItemsByKey.get(key);

        if (existingItem) {
          const response = await this.updateDomain(
            normalizedRow.domain,
            normalizedRow.type,
            normalizedRow.kind,
            {
              comment: normalizedRow.comment,
              groups: normalizedRow.groups,
              enabled: normalizedRow.enabled,
            },
            request,
          );

          if (response.failedInstances.length > 0) {
            throw new Error(response.failedInstances.map((failure) => failure.message).join(" | "));
          }

          results.summary.updatedCount += 1;
          existingItemsByKey.set(key, {
            ...existingItem,
            comment: normalizedRow.comment,
            groups: normalizedRow.groups,
            enabled: normalizedRow.enabled,
          });
          continue;
        }

        const createResponse = await this.createImportedDomain(normalizedRow, request);

        if (createResponse.failedInstances.length > 0) {
          throw new Error(createResponse.failedInstances.map((failure) => failure.message).join(" | "));
        }

        if (!normalizedRow.enabled) {
          const disableResponse = await this.updateDomain(
            normalizedRow.domain,
            normalizedRow.type,
            normalizedRow.kind,
            {
              comment: normalizedRow.comment,
              groups: normalizedRow.groups,
              enabled: false,
            },
            request,
          );

          if (disableResponse.failedInstances.length > 0) {
            throw new Error(disableResponse.failedInstances.map((failure) => failure.message).join(" | "));
          }
        }

        results.summary.createdCount += 1;
        existingItemsByKey.set(key, {
          domain: normalizedRow.domain,
          unicode: null,
          type: normalizedRow.type,
          kind: normalizedRow.kind,
          comment: normalizedRow.comment,
          groups: normalizedRow.groups,
          enabled: normalizedRow.enabled,
          id: 0,
          dateAdded: null,
          dateModified: null,
          origin: listedData.items[0]?.origin ?? { instanceId: "", instanceName: "" },
          sync: {
            isFullySynced: true,
            sourceInstances: [],
            missingInstances: [],
          },
        });
      } catch (error) {
        results.status = "partial";
        results.summary.invalidCount += 1;
        results.errors.push({
          line: row.line,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.audit.record({
      action: "domains.import",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "domain",
      targetId: "csv",
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        summary: results.summary,
        errors: results.errors as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  async getDomain(params: DomainItemParamsDto, request: Request): Promise<DomainItem> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots } = await this.prepareSnapshotsForList(instances, request);
    const item = this.buildListedDomains(snapshots, baseline.id).find(
      (candidate) =>
        candidate.domain === params.domain && candidate.type === params.type && candidate.kind === params.kind,
    );

    if (!item) {
      throw new NotFoundException("Domain not found.");
    }

    return item;
  }

  private async getListedDomainsData(query: GetDomainsDto, request: Request): Promise<ListedDomainsData> {
    const locale = getRequestLocale(request);
    const searchTerm = query.search?.trim() ?? "";
    const filters = query.filters ?? [];
    const instances = await this.loadManagedInstances();
    const baseline = instances.find((instance) => instance.isBaseline);

    if (!baseline) {
      throw new BadRequestException(translateApi(locale, "session.baselineRequired"));
    }

    const { snapshots, unavailableInstances } = await this.prepareSnapshotsForList(instances, request);
    const consolidatedItems = this.buildListedDomains(snapshots, baseline.id);
    const filteredItems = consolidatedItems
      .filter((item) => (searchTerm.length > 0 ? matchesDomainSearch(item, searchTerm) : true))
      .filter((item) => (filters.length > 0 ? matchesDomainFilters(item, filters) : true));
    const sortedItems = sortDomainItems(filteredItems, query.sortBy, query.sortDirection);

    await Promise.all(
      consolidatedItems.map((item) =>
        this.prisma.managedDomain.upsert({
          where: {
            domain_type_kind: {
              domain: item.domain,
              type: item.type,
              kind: item.kind,
            },
          },
          update: {
            comment: item.comment,
            groups: item.groups,
            enabled: item.enabled,
          },
          create: {
            domain: item.domain,
            type: item.type,
            kind: item.kind,
            comment: item.comment,
            groups: item.groups,
            enabled: item.enabled,
          },
        }),
      ),
    );

    return {
      items: sortedItems,
      summary: this.buildDomainsSummary(consolidatedItems),
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

  async applyDomainOperation(
    params: DomainOperationParamsDto,
    body: ApplyDomainOperationDto,
    request: Request,
  ): Promise<DomainOperationResponse> {
    const locale = getRequestLocale(request);
    const normalizedDomain = body.domain.trim().toLowerCase();
    const comment = body.comment ?? DEFAULT_DOMAIN_OPERATION_COMMENT;
    const patternMode = body.patternMode ?? null;
    const value = params.kind === "regex" ? this.buildRegexPattern(normalizedDomain, patternMode) : normalizedDomain;
    const effectiveScope = params.type === "deny" && params.kind === "exact" ? "all" : body.scope;
    const effectiveInstanceId = effectiveScope === "instance" ? (body.instanceId ?? undefined) : undefined;
    const instances = await this.resolveRequestedInstances(effectiveScope, effectiveInstanceId, locale);
    const groups = body.groups ?? [0];
    const { successfulInstances, failedInstances } = await this.createDomainAcrossInstances(
      {
        domain: normalizedDomain,
        value,
        type: params.type as DomainOperationType,
        kind: params.kind as DomainOperationKind,
        comment,
        groups,
      },
      instances,
      locale,
    );

    await this.audit.record({
      action: "domains.create",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "domain",
      targetId: value,
      result: failedInstances.length === 0 ? "SUCCESS" : "FAILURE",
      details: {
        params: params as unknown as Prisma.InputJsonValue,
        body: body as unknown as Prisma.InputJsonValue,
        summary: {
          totalInstances: instances.length,
          successfulCount: successfulInstances.length,
          failedCount: failedInstances.length,
        },
        failedInstances: failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      request: {
        type: params.type as DomainOperationType,
        kind: params.kind as DomainOperationKind,
        domain: normalizedDomain,
        value,
        comment,
        patternMode,
        scope: effectiveScope,
        instanceId: effectiveInstanceId ?? null,
      },
      summary: {
        totalInstances: instances.length,
        successfulCount: successfulInstances.length,
        failedCount: failedInstances.length,
      },
      successfulInstances,
      failedInstances,
    };
  }

  async updateDomain(
    domain: string,
    type: string,
    kind: string,
    body: UpdateDomainDto,
    request: Request,
  ): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.resolveRequestedInstances("all", undefined, locale);
    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    // Update local DB
    await this.prisma.managedDomain
      .update({
        where: { domain_type_kind: { domain, type, kind } },
        data: { comment: body.comment, groups: body.groups, enabled: body.enabled },
      })
      .catch(() => {
        // Ignore if not in local DB
      });

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          await this.pihole.updateDomain(connection, session, domain, type, kind, {
            comment: body.comment,
            groups: body.groups,
            enabled: body.enabled,
          });
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    await this.audit.record({
      action: "domains.update",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "domain",
      targetId: domain,
      result: results.status === "success" ? "SUCCESS" : "FAILURE",
      details: {
        domain,
        type,
        kind,
        body: body as unknown as Prisma.InputJsonValue,
        summary: results.summary,
        failedInstances: results.failedInstances as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  private async createImportedDomain(row: DomainImportRowInput, request: Request) {
    const locale = getRequestLocale(request);
    const instances = await this.resolveRequestedInstances("all", undefined, locale);

    const response = await this.createDomainAcrossInstances(
      {
        domain: row.domain,
        value: row.domain,
        type: row.type,
        kind: row.kind,
        comment: row.comment ?? DEFAULT_DOMAIN_OPERATION_COMMENT,
        groups: row.groups,
      },
      instances,
      locale,
    );

    return {
      summary: {
        totalInstances: instances.length,
        successfulCount: response.successfulInstances.length,
        failedCount: response.failedInstances.length,
      },
      successfulInstances: response.successfulInstances,
      failedInstances: response.failedInstances,
    };
  }

  async batchDelete(body: BatchDeleteDomainsDto, request: Request): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.resolveRequestedInstances("all", undefined, locale);
    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    // Delete from local DB
    for (const item of body.items) {
      await this.prisma.managedDomain
        .delete({
          where: { domain_type_kind: { domain: item.item, type: item.type, kind: item.kind } },
        })
        .catch(() => {
          // Ignore if not in local DB
        });
    }

    for (const instance of instances) {
      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const item of body.items) {
            await this.pihole.deleteDomain(connection, session, item.item, item.type, item.kind);
          }
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
        results.summary.failedCount++;
        results.status = "partial";
      }
    }

    return results;
  }

  async syncDomains(body: SyncDomainsDto, request: Request): Promise<DomainsMutationResponse> {
    const locale = getRequestLocale(request);
    const instances = await this.loadManagedInstances();

    if (body.domain && body.type && body.kind && body.sourceInstanceId && body.targetInstanceIds) {
      // Single sync
      const targetInstances = instances.filter((i) => body.targetInstanceIds?.includes(i.id));
      const results: DomainsMutationResponse = {
        status: "success",
        summary: { totalInstances: targetInstances.length, successfulCount: 0, failedCount: 0 },
        successfulInstances: [],
        failedInstances: [],
      };

      let sourceData: ManagedDomainRecord | null = null;
      try {
        await this.instanceSessions.withActiveSession(
          body.sourceInstanceId,
          locale,
          async ({ connection, session }) => {
            const result = await this.pihole.listDomains(connection, session);
            const entry = result.domains.find(
              (d) => d.domain === body.domain && d.type === body.type && d.kind === body.kind,
            );
            if (entry) {
              sourceData = {
                domain: entry.domain || "",
                unicode: entry.unicode,
                type: entry.type || "",
                kind: entry.kind || "",
                comment: entry.comment,
                groups: entry.groups,
                enabled: entry.enabled || false,
                id: entry.id || 0,
                dateAdded: entry.dateAdded,
                dateModified: entry.dateModified,
              };
            }
          },
        );
      } catch (error) {
        throw new BadRequestException(
          `Failed to read from source instance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!sourceData) throw new BadRequestException("Domain not found on source instance");

      const finalSourceData = sourceData as ManagedDomainRecord;
      for (const instance of targetInstances) {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            await this.pihole.applyDomainOperation(connection, session, {
              type: finalSourceData.type as PiholeDomainOperationType,
              kind: finalSourceData.kind as PiholeDomainOperationKind,
              value: finalSourceData.domain,
              comment: finalSourceData.comment ?? undefined,
              groups: finalSourceData.groups,
              enabled: finalSourceData.enabled,
            });
          });
          results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
          results.summary.successfulCount++;
        } catch (error) {
          results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
          results.summary.failedCount++;
          results.status = "partial";
        }
      }
      return results;
    }

    // Bulk sync
    const { snapshots } = await this.prepareSnapshotsForList(instances, request);
    const allKeys = new Set<string>();
    for (const snapshot of snapshots) {
      for (const key of snapshot.domainsByKey.keys()) {
        allKeys.add(key);
      }
    }

    const results: DomainsMutationResponse = {
      status: "success",
      summary: { totalInstances: instances.length, successfulCount: 0, failedCount: 0 },
      successfulInstances: [],
      failedInstances: [],
    };

    for (const instance of instances) {
      const snapshot = snapshots.find((s) => s.instance.id === instance.id);
      const missingKeys = [...allKeys].filter((key) => !snapshot?.domainsByKey.has(key));

      if (missingKeys.length === 0) {
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
        continue;
      }

      try {
        await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
          for (const key of missingKeys) {
            const sourceSnap =
              snapshots.find((s) => s.instance.isBaseline && s.domainsByKey.has(key)) ||
              snapshots.find((s) => s.domainsByKey.has(key));
            const data = sourceSnap?.domainsByKey.get(key);
            if (data) {
              await this.pihole.applyDomainOperation(connection, session, {
                type: data.type as PiholeDomainOperationType,
                kind: data.kind as PiholeDomainOperationKind,
                value: data.domain,
                comment: data.comment ?? undefined,
                groups: data.groups,
                enabled: data.enabled,
              });
            }
          }
        });
        results.successfulInstances.push({ instanceId: instance.id, instanceName: instance.name });
        results.summary.successfulCount++;
      } catch (error) {
        results.failedInstances.push(this.mapInstanceFailure(instance, error, locale));
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
  ): Promise<DomainSnapshotsResult> {
    const locale = getRequestLocale(request);
    const snapshots: InstanceDomainsSnapshot[] = [];
    const unavailableInstances: DomainsInstanceFailure[] = [];

    await Promise.all(
      instances.map(async (instance) => {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            const result = await this.pihole.listDomains(connection, session);
            const domainsByKey = new Map<string, ManagedDomainRecord>();
            for (const entry of result.domains) {
              if (entry.domain && entry.type && entry.kind) {
                const key = buildDomainKey(entry.domain, entry.type, entry.kind);
                domainsByKey.set(key, {
                  domain: entry.domain,
                  unicode: entry.unicode,
                  type: entry.type,
                  kind: entry.kind,
                  comment: entry.comment,
                  groups: entry.groups,
                  enabled: entry.enabled ?? false,
                  id: entry.id ?? 0,
                  dateAdded: entry.dateAdded,
                  dateModified: entry.dateModified,
                });
              }
            }
            snapshots.push({ instance, domainsByKey });
          });
        } catch (error) {
          unavailableInstances.push(this.mapInstanceFailure(instance, error, locale));
        }
      }),
    );

    return { snapshots, unavailableInstances };
  }

  private buildListedDomains(snapshots: InstanceDomainsSnapshot[], baselineId: string): DomainItem[] {
    const allKeys = new Set<string>();
    for (const s of snapshots) for (const key of s.domainsByKey.keys()) allKeys.add(key);

    const items: DomainItem[] = [];
    for (const key of allKeys) {
      let referenceRecord: ManagedDomainRecord | null = null;
      let originInstanceId = "";
      let originInstanceName = "";

      const baselineSnap = snapshots.find((s) => s.instance.id === baselineId);
      const baselineRecord = baselineSnap?.domainsByKey.get(key);
      if (baselineRecord) {
        referenceRecord = baselineRecord;
        originInstanceId = baselineSnap?.instance.id || "";
        originInstanceName = baselineSnap?.instance.name || "";
      }

      const sourceInstances: DomainsInstanceSource[] = [];
      const missingInstances: DomainsInstanceSource[] = [];

      for (const snapshot of snapshots) {
        const snapRecord = snapshot.domainsByKey.get(key);
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
    return sortDomainItems(items, DEFAULT_DOMAINS_SORT_FIELD, DEFAULT_DOMAINS_SORT_DIRECTION);
  }

  private buildDomainsSummary(items: DomainItem[]) {
    return items.reduce(
      (summary, item) => {
        summary.totalItems += 1;

        if (item.type === "allow") {
          summary.allowTotal += 1;

          if (item.kind === "exact") {
            summary.allowExact += 1;
          } else if (item.kind === "regex") {
            summary.allowRegex += 1;
          }
        } else if (item.type === "deny") {
          summary.denyTotal += 1;

          if (item.kind === "exact") {
            summary.denyExact += 1;
          } else if (item.kind === "regex") {
            summary.denyRegex += 1;
          }
        }

        return summary;
      },
      {
        totalItems: 0,
        allowTotal: 0,
        denyTotal: 0,
        allowExact: 0,
        allowRegex: 0,
        denyExact: 0,
        denyRegex: 0,
      },
    );
  }

  private buildRegexPattern(domain: string, patternMode: DomainPatternMode | null) {
    if (patternMode === "regex_specific") {
      return `(\\.|^)${domain.replaceAll(".", "\\.")}\\.com$`;
    }
    if (patternMode === "regex_any") {
      const base = domain.split(".")[0];
      return `(^|\\.)${base}(\\.[a-z]{2,})+$`;
    }
    const escaped = domain.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return `(^|\\.)${escaped}$`;
  }

  private async createDomainAcrossInstances(
    params: {
      domain: string;
      value: string;
      type: DomainOperationType;
      kind: DomainOperationKind;
      comment: string;
      groups: number[];
    },
    instances: PiholeManagedInstanceSummary[],
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    await this.prisma.managedDomain.upsert({
      where: {
        domain_type_kind: {
          domain: params.value,
          type: params.type,
          kind: params.kind,
        },
      },
      update: { comment: params.comment, enabled: true, groups: params.groups },
      create: {
        domain: params.value,
        type: params.type,
        kind: params.kind,
        comment: params.comment,
        enabled: true,
        groups: params.groups,
      },
    });

    const settled = await Promise.all(
      instances.map(async (instance) => {
        try {
          const result = await this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
            this.pihole.applyDomainOperation(connection, session, {
              type: params.type as PiholeDomainOperationType,
              kind: params.kind as PiholeDomainOperationKind,
              value: params.value,
              comment: params.comment,
              groups: params.groups,
              enabled: true,
            }),
          );

          if (result.processed.errors.length > 0) {
            return {
              status: "rejected" as const,
              instance,
              failure: this.mapProcessedFailure(instance, result, locale),
            };
          }

          return {
            status: "fulfilled" as const,
            instance,
            result,
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            instance,
            failure: this.mapInstanceFailure(instance, error, locale),
          };
        }
      }),
    );

    const successfulInstances: Array<
      DomainsInstanceSource & { processed: PiholeDomainMutationResult["processed"]; took: number | null }
    > = [];
    const failedInstances: DomainsInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successfulInstances.push({
          instanceId: item.instance.id,
          instanceName: item.instance.name,
          processed: item.result.processed,
          took: item.result.took,
        });
      } else {
        failedInstances.push(item.failure);
      }
    }

    return {
      successfulInstances,
      failedInstances,
    };
  }

  private normalizeImportedRow(
    row: {
      line: number;
      domain: string;
      type: string;
      kind: string;
      enabled: string;
      comment: string;
      group: string;
    },
    groupMappings: GroupMappings,
  ): DomainImportRowInput {
    const domain = row.domain.trim().toLowerCase();

    if (domain.length === 0) {
      throw new Error("Domain is required.");
    }

    if (row.type !== "allow" && row.type !== "deny") {
      throw new Error(`Invalid type "${row.type}". Expected allow or deny.`);
    }

    if (row.kind !== "exact" && row.kind !== "regex") {
      throw new Error(`Invalid kind "${row.kind}". Expected exact or regex.`);
    }

    const enabled = parseDomainEnabledValue(row.enabled);
    if (enabled === null) {
      throw new Error(`Invalid enabled value "${row.enabled}". Expected enabled or disabled.`);
    }

    const groupTokens = parseDomainGroupCell(row.group);
    const resolvedGroups = groupTokens.map((token) => {
      const normalizedToken = token.trim().toLowerCase();

      if (normalizedToken.startsWith("id:")) {
        const rawId = normalizedToken.slice(3);
        const parsed = Number(rawId);
        if (!Number.isInteger(parsed)) {
          throw new Error(`Invalid group token "${token}".`);
        }
        return parsed;
      }

      if (/^\d+$/.test(normalizedToken)) {
        return Number(normalizedToken);
      }

      const groupId = groupMappings.normalizedNameToId.get(normalizedToken);
      if (groupId === undefined) {
        throw new Error(`Unknown group "${token}".`);
      }

      return groupId;
    });

    return {
      domain,
      type: row.type,
      kind: row.kind,
      comment: row.comment.trim().length > 0 ? row.comment : null,
      enabled,
      groups: resolvedGroups.length > 0 ? resolvedGroups : [0],
    };
  }

  private async loadGroupMappings(locale: ReturnType<typeof getRequestLocale>): Promise<GroupMappings> {
    const instances = await this.loadManagedInstances();
    const idToCandidate = new Map<number, { name: string; rank: number }>();
    const nameToCandidate = new Map<string, { id: number; rank: number }>();

    await Promise.all(
      instances.map(async (instance, index) => {
        try {
          await this.instanceSessions.withActiveSession(instance.id, locale, async ({ connection, session }) => {
            const result = await this.pihole.listGroups(connection, session);

            for (const group of result.groups) {
              if (group.id === null || group.name === null) {
                continue;
              }

              const rank = instance.isBaseline ? -1_000 : index;
              const normalizedName = group.name.trim().toLowerCase();
              const currentIdCandidate = idToCandidate.get(group.id);
              const currentNameCandidate = nameToCandidate.get(normalizedName);

              if (!currentIdCandidate || rank < currentIdCandidate.rank) {
                idToCandidate.set(group.id, { name: group.name, rank });
              }

              if (!currentNameCandidate || rank < currentNameCandidate.rank) {
                nameToCandidate.set(normalizedName, { id: group.id, rank });
              }
            }
          });
        } catch {
          // Ignore unavailable instances for CSV mapping.
        }
      }),
    );

    return {
      idToName: new Map([...idToCandidate.entries()].map(([id, candidate]) => [id, candidate.name])),
      normalizedNameToId: new Map([...nameToCandidate.entries()].map(([name, candidate]) => [name, candidate.id])),
    };
  }

  private resolveRequestedInstances(
    scope: DomainScopeMode,
    instanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (scope === "instance") {
      if (!instanceId) {
        throw new BadRequestException(translateApi(locale, "domains.instanceIdRequired"));
      }
      return this.instanceSessions.getInstanceSummary(instanceId, locale).then((s) => [s]);
    }
    return this.instanceSessions.listInstanceSummaries();
  }

  private mapProcessedFailure(
    instance: PiholeManagedInstanceSummary,
    result: PiholeDomainMutationResult,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    const firstError = result.processed.errors.find(
      (item) => (item.message?.trim().length ?? 0) > 0 || (item.item?.trim().length ?? 0) > 0,
    );
    const message =
      firstError?.message ??
      (firstError?.item
        ? `${firstError.item}`
        : translateApi(locale, "domains.operationRejected", { baseUrl: instance.baseUrl }));
    return { instanceId: instance.id, instanceName: instance.name, kind: "pihole_response_error", message };
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        instanceId: instance.id,
        instanceName: instance.name,
        kind: error.kind,
        message: error.message || translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
      };
    }
    return {
      instanceId: instance.id,
      instanceName: instance.name,
      kind: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
