import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuditService } from "../audit/audit.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { getRequestIp } from "../common/http/request-context";
import { getRequestLocale } from "../common/i18n/locale";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { DomainsService } from "../domains/domains.service";
import type { DomainOperationActorContext, DomainOperationKind, DomainOperationType } from "../domains/domains.types";
import {
  BROWSER_EXTENSION_COMMENT_PREFIX,
  BROWSER_EXTENSION_DEFAULT_PAGE_SIZE,
  BROWSER_EXTENSION_MAX_PAGE_SIZE,
  BROWSER_EXTENSION_PAIRING_CODE_TTL_MS,
  BROWSER_EXTENSION_SETTINGS_ID,
  type BrowserExtensionAuthContext,
  type BrowserExtensionConfigResponse,
  type BrowserExtensionKind,
  type BrowserExtensionRuleCacheItem,
  type BrowserExtensionSettingsPayload,
  sha256Hex,
  timingSafeEqualString,
} from "./browser-extension.types";
import type { BrowserExtensionAuthenticatedRequest } from "./browser-extension-auth.guard";
import { getRegistrableDomainGuess } from "./domain-utils";
import type { ApplyExtensionDetectionsDto } from "./dto/apply-extension-detections.dto";
import type { GetExtensionDetectionsDto } from "./dto/get-extension-detections.dto";
import type { PairExtensionDto } from "./dto/pair-extension.dto";
import type { ReportExtensionDetectionsDto } from "./dto/report-extension-detections.dto";
import type { UndoExtensionBatchDto } from "./dto/undo-extension-batch.dto";
import type { UpdateExtensionSettingsDto } from "./dto/update-extension-settings.dto";
import { randomInt } from "node:crypto";

type ExtensionApplyResultItem = {
  target: string;
  type: "deny";
  kind: BrowserExtensionKind;
  status: "applied" | "skipped" | "failed";
  errorMessage?: string;
};

type ExtensionUndoResultItem = {
  target: string;
  type: "deny";
  kind: BrowserExtensionKind;
  errorMessage?: string;
};

const RAW_REGEX_CHARS = /[\\^$*+?()[\]{}|]/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{1,62}$/i;

@Injectable()
export class BrowserExtensionService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Inject(DomainsService) private readonly domains: DomainsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createPairingCode(request: Request) {
    const pairingCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + BROWSER_EXTENSION_PAIRING_CODE_TTL_MS);

    await this.prisma.browserExtensionPairingCode.create({
      data: {
        codeHash: sha256Hex(pairingCode),
        expiresAt,
      },
    });

    await this.audit.record({
      action: "browser_extension.pairing_code.create",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_pairing_code",
      targetId: "new",
      result: "SUCCESS",
      details: {
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      pairingCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async pairExtension(dto: PairExtensionDto, request: Request) {
    const now = new Date();
    const codeHash = sha256Hex(dto.pairingCode);
    const pairingCode = await this.prisma.browserExtensionPairingCode.findUnique({ where: { codeHash } });

    if (!pairingCode || pairingCode.expiresAt <= now || pairingCode.usedAt) {
      await this.recordPairAudit(request, "FAILURE", "Invalid, expired, or used pairing code.");
      throw new BadRequestException("Invalid, expired, or used pairing code.");
    }

    const accessToken = this.crypto.createToken();
    const tokenHash = sha256Hex(accessToken);
    const tokenPrefix = accessToken.slice(0, 8);

    const { device, settings } = await this.prisma.$transaction(async (tx) => {
      const update = await tx.browserExtensionPairingCode.updateMany({
        where: {
          id: pairingCode.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      if (update.count !== 1) {
        throw new BadRequestException("Pairing code was already used.");
      }

      const createdDevice = await tx.browserExtensionDevice.create({
        data: {
          name: dto.extensionName.trim(),
          browser: dto.browser.trim(),
          manifestVersion: dto.manifestVersion,
          extensionVersion: dto.extensionVersion.trim(),
          tokenHash,
          tokenPrefix,
          lastSeenAt: now,
        },
      });
      const upsertedSettings = await tx.browserExtensionSettings.upsert({
        where: { id: BROWSER_EXTENSION_SETTINGS_ID },
        update: {},
        create: { id: BROWSER_EXTENSION_SETTINGS_ID },
      });

      return { device: createdDevice, settings: upsertedSettings };
    });
    const cache = await this.readRuleCache();

    await this.recordPairAudit(request, "SUCCESS", null, device.id);

    return {
      accessToken,
      extensionId: device.id,
      settings: this.mapSettings(settings),
      allowlist: cache.allowlist,
      blockedItems: cache.blockedItems,
    };
  }

  async getConfig(): Promise<BrowserExtensionConfigResponse> {
    const [settings, cache] = await Promise.all([this.ensureSettings(), this.readRuleCache()]);

    return {
      settings: this.mapSettings(settings),
      allowlist: cache.allowlist,
      blockedItems: cache.blockedItems,
    };
  }

  async getSettings() {
    return this.mapSettings(await this.ensureSettings());
  }

  async updateSettings(dto: UpdateExtensionSettingsDto, request: Request) {
    const settings = await this.prisma.browserExtensionSettings.upsert({
      where: { id: BROWSER_EXTENSION_SETTINGS_ID },
      update: {
        ...(dto.sendPageTitle !== undefined ? { sendPageTitle: dto.sendPageTitle } : {}),
        ...(dto.hardBlockedUrlPatterns !== undefined ? { hardBlockedUrlPatterns: dto.hardBlockedUrlPatterns } : {}),
        ...(dto.sensitiveUrlPatterns !== undefined ? { sensitiveUrlPatterns: dto.sensitiveUrlPatterns } : {}),
      },
      create: {
        id: BROWSER_EXTENSION_SETTINGS_ID,
        sendPageTitle: dto.sendPageTitle ?? false,
        hardBlockedUrlPatterns: dto.hardBlockedUrlPatterns ?? [],
        sensitiveUrlPatterns: dto.sensitiveUrlPatterns ?? [],
      },
    });

    await this.audit.record({
      action: "browser_extension.settings.update",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_settings",
      targetId: BROWSER_EXTENSION_SETTINGS_ID,
      result: "SUCCESS",
      details: this.mapSettings(settings) as unknown as Prisma.InputJsonValue,
    });

    return this.mapSettings(settings);
  }

  async listDevices() {
    const devices = await this.prisma.browserExtensionDevice.findMany({
      orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }, { createdAt: "desc" }],
    });

    return {
      items: devices.map((device) => ({
        id: device.id,
        name: device.name,
        browser: device.browser,
        manifestVersion: device.manifestVersion,
        extensionVersion: device.extensionVersion,
        tokenPrefix: device.tokenPrefix,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        revokedAt: device.revokedAt?.toISOString() ?? null,
        createdAt: device.createdAt.toISOString(),
      })),
    };
  }

  async revokeDevice(id: string, request: Request) {
    const existing = await this.prisma.browserExtensionDevice.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Browser extension device not found.");
    }

    const revokedAt = existing.revokedAt ?? new Date();
    const device = await this.prisma.browserExtensionDevice.update({
      where: { id },
      data: { revokedAt },
    });

    await this.audit.record({
      action: "browser_extension.device.revoke",
      actorType: "user",
      actorLabel: "Admin",
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_device",
      targetId: id,
      result: "SUCCESS",
      details: {
        tokenPrefix: device.tokenPrefix,
      },
    });

    return {
      id: device.id,
      revokedAt: revokedAt.toISOString(),
    };
  }

  async applyDetections(dto: ApplyExtensionDetectionsDto, request: BrowserExtensionAuthenticatedRequest) {
    const device = this.requireAuthenticatedDevice(request);

    if (dto.extension.extensionId !== device.id) {
      throw new ForbiddenException("Payload extensionId does not match the authenticated extension.");
    }

    const existing = await this.prisma.browserExtensionDetectionBatch.findUnique({
      where: { clientRequestId: dto.clientRequestId },
    });

    if (existing) {
      throw new ConflictException("clientRequestId was already processed.");
    }

    const sourceBatch = dto.sourceBatchId
      ? await this.prisma.browserExtensionDetectionBatch.findUnique({
          where: { id: dto.sourceBatchId },
          include: { items: true },
        })
      : null;

    if (dto.sourceBatchId && (!sourceBatch || sourceBatch.extensionId !== device.id)) {
      throw new NotFoundException("Source browser extension batch not found.");
    }

    if (sourceBatch && (sourceBatch.undoTokenHash || sourceBatch.status !== "detected")) {
      throw new ConflictException("Source browser extension batch was already applied.");
    }

    if (sourceBatch && sourceBatch.pageDomain !== dto.page.domain.toLowerCase()) {
      throw new BadRequestException("sourceBatchId page domain does not match the payload page domain.");
    }

    this.assertValidDomainTarget(dto.page.domain, "page.domain");
    for (const target of dto.approvedTargets) {
      this.assertValidDomainTarget(target.target, "approvedTargets.target");
    }

    const context = this.buildExtensionActorContext(device, request);
    const undoToken = this.crypto.createToken();
    const applied: ExtensionApplyResultItem[] = [];
    const skipped: ExtensionApplyResultItem[] = [];
    const failed: ExtensionApplyResultItem[] = [];
    const persistedItems: Array<{
      candidateId: string;
      target: string;
      targetMainDomain: string;
      type: "deny";
      kind: BrowserExtensionKind;
      category: string;
      score: number;
      riskLevel: string;
      reasons: string[];
      evidence: Record<string, unknown>;
      applyStatus: "applied" | "skipped" | "failed";
      errorMessage?: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const target of dto.approvedTargets) {
      const dedupeKey = `${target.type}:${target.kind}:${target.target.toLowerCase()}`;

      if (seen.has(dedupeKey)) {
        const skippedItem = this.buildApplyResultItem(target.target, target.kind, "skipped", "Duplicate target.");
        skipped.push(skippedItem);
        persistedItems.push(this.buildPersistedItem(target, skippedItem.target, "skipped", skippedItem.errorMessage));
        continue;
      }

      seen.add(dedupeKey);

      try {
        const operation = await this.domains.applyDomainOperationForActor(
          {
            domain: target.target,
            type: target.type as DomainOperationType,
            kind: target.kind as DomainOperationKind,
            comment: `${BROWSER_EXTENSION_COMMENT_PREFIX}: ${dto.page.domain}`,
            patternMode: target.kind === "regex" ? (target.patternMode ?? "exact") : null,
            groups: [0],
          },
          context,
        );
        const appliedTarget = operation.request.value;

        if (operation.successfulInstances.length === 0) {
          const message = this.joinInstanceFailures(operation.failedInstances);
          const failedItem = this.buildApplyResultItem(appliedTarget, target.kind, "failed", message);
          failed.push(failedItem);
          persistedItems.push(this.buildPersistedItem(target, appliedTarget, "failed", message));
          continue;
        }

        const appliedItem = this.buildApplyResultItem(appliedTarget, target.kind, "applied");
        applied.push(appliedItem);
        persistedItems.push(this.buildPersistedItem(target, appliedTarget, "applied", null));
        await this.upsertDenyDecision(appliedTarget, target.kind);

        if (operation.failedInstances.length > 0) {
          const message = this.joinInstanceFailures(operation.failedInstances);
          failed.push(this.buildApplyResultItem(appliedTarget, target.kind, "failed", message));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedItem = this.buildApplyResultItem(target.target, target.kind, "failed", message);
        failed.push(failedItem);
        persistedItems.push(this.buildPersistedItem(target, target.target, "failed", message));
      }
    }

    const status = this.resolveApplyStatus(applied.length, skipped.length, failed.length);
    const summary = {
      totalTargets: dto.approvedTargets.length,
      appliedCount: applied.length,
      failedCount: failed.length,
      skippedCount: skipped.length,
    };
    const batch = sourceBatch
      ? await this.updateDetectedBatchWithApplyResult(sourceBatch.id, dto, status, undoToken, summary, persistedItems)
      : await this.prisma.browserExtensionDetectionBatch.create({
          data: {
            extensionId: device.id,
            clientRequestId: dto.clientRequestId,
            pageDomain: dto.page.domain.toLowerCase(),
            pageMainDomain: getRegistrableDomainGuess(dto.page.domain),
            pageUrl: dto.page.url,
            pageTitle: dto.page.title ?? null,
            status,
            undoTokenHash: sha256Hex(undoToken),
            summary: summary as unknown as Prisma.InputJsonValue,
            items: {
              create: persistedItems.map((item) => this.mapItemCreateInput(item)),
            },
          },
        });

    await this.audit.record({
      action: "browser_extension.detections.apply",
      actorType: "browser_extension",
      actorLabel: device.name,
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_detection_batch",
      targetId: batch.id,
      result: status === "applied" ? "SUCCESS" : "FAILURE",
      details: {
        pageDomain: dto.page.domain,
        summary,
      } as Prisma.InputJsonValue,
    });

    return {
      batchId: batch.id,
      undoToken,
      status,
      summary,
      applied,
      skipped,
      failed,
    };
  }

  async reportDetections(dto: ReportExtensionDetectionsDto, request: BrowserExtensionAuthenticatedRequest) {
    const device = this.requireAuthenticatedDevice(request);

    if (dto.extension.extensionId !== device.id) {
      throw new ForbiddenException("Payload extensionId does not match the authenticated extension.");
    }

    const existing = await this.prisma.browserExtensionDetectionBatch.findUnique({
      where: { clientRequestId: dto.clientRequestId },
    });

    if (existing) {
      throw new ConflictException("clientRequestId was already processed.");
    }

    this.assertValidHostTarget(dto.page.domain, "page.domain");
    for (const target of dto.detectedTargets) {
      this.assertValidHostTarget(target.target, "detectedTargets.target");
    }

    const cache = await this.readRuleCache();
    const items = dto.detectedTargets.map((target) => {
      const normalizedTarget = target.target.trim().toLowerCase();
      const alreadyAllowed = cache.allowlist.some((item) => item.target === normalizedTarget);
      const alreadyBlocked = cache.blockedItems.some((item) => item.target === normalizedTarget);
      const applyStatus = alreadyAllowed ? "allowed" : alreadyBlocked ? "blocked" : "detected";

      return {
        candidateId: target.candidateId,
        target: normalizedTarget,
        targetMainDomain: getRegistrableDomainGuess(normalizedTarget),
        type: "deny",
        kind: "exact",
        category: target.category,
        score: target.score,
        riskLevel: target.riskLevel,
        reasons: target.reasons,
        evidence: target.evidence as unknown as Record<string, unknown>,
        applyStatus,
        errorMessage: null,
      };
    });
    const summary = {
      totalTargets: items.length,
      detectedCount: items.filter((item) => item.applyStatus === "detected").length,
      blockedCount: items.filter((item) => item.applyStatus === "blocked").length,
      allowedCount: items.filter((item) => item.applyStatus === "allowed").length,
    };
    const batch = await this.prisma.browserExtensionDetectionBatch.create({
      data: {
        extensionId: device.id,
        clientRequestId: dto.clientRequestId,
        pageDomain: dto.page.domain.toLowerCase(),
        pageMainDomain: getRegistrableDomainGuess(dto.page.domain),
        pageUrl: dto.page.url,
        pageTitle: dto.page.title ?? null,
        status: "detected",
        summary: summary as unknown as Prisma.InputJsonValue,
        items: {
          create: items.map((item) => this.mapItemCreateInput(item)),
        },
      },
    });

    await this.audit.record({
      action: "browser_extension.detections.report",
      actorType: "browser_extension",
      actorLabel: device.name,
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_detection_batch",
      targetId: batch.id,
      result: "SUCCESS",
      details: {
        pageDomain: dto.page.domain,
        pageMainDomain: getRegistrableDomainGuess(dto.page.domain),
        summary,
      } as Prisma.InputJsonValue,
    });

    return {
      batchId: batch.id,
      status: "detected" as const,
      summary,
    };
  }

  async undoLast(dto: UndoExtensionBatchDto, request: BrowserExtensionAuthenticatedRequest) {
    const device = this.requireAuthenticatedDevice(request);
    const batch = await this.prisma.browserExtensionDetectionBatch.findUnique({
      where: { id: dto.batchId },
      include: { items: true },
    });

    if (!batch || batch.extensionId !== device.id) {
      throw new NotFoundException("Browser extension batch not found.");
    }

    if (batch.status === "undone") {
      throw new BadRequestException("Browser extension batch was already undone.");
    }

    if (!batch.undoTokenHash || !timingSafeEqualString(batch.undoTokenHash, sha256Hex(dto.undoToken))) {
      throw new ForbiddenException("Invalid undo token.");
    }

    const latestBatch = await this.prisma.browserExtensionDetectionBatch.findFirst({
      where: {
        extensionId: device.id,
        undoTokenHash: { not: null },
      },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true },
    });

    if (latestBatch?.id !== batch.id) {
      throw new BadRequestException("Only the latest browser extension batch can be undone.");
    }

    const appliedItems = batch.items.filter((item) => item.applyStatus === "applied");
    const context = this.buildExtensionActorContext(device, request);
    const removal = await this.domains.deleteDomainsForActor(
      appliedItems.map((item) => ({
        item: item.target,
        type: item.type as DomainOperationType,
        kind: item.kind as DomainOperationKind,
      })),
      context,
    );
    const failedMessage = this.joinInstanceFailures(removal.failedInstances);
    const removed: ExtensionUndoResultItem[] =
      removal.failedInstances.length === 0
        ? appliedItems.map((item) => ({ target: item.target, type: "deny", kind: item.kind as BrowserExtensionKind }))
        : [];
    const failed: ExtensionUndoResultItem[] =
      removal.failedInstances.length > 0
        ? appliedItems.map((item) => ({
            target: item.target,
            type: "deny",
            kind: item.kind as BrowserExtensionKind,
            errorMessage: failedMessage,
          }))
        : [];
    const summary = {
      totalTargets: appliedItems.length,
      removedCount: removed.length,
      failedCount: failed.length,
    };

    await this.prisma.$transaction([
      this.prisma.browserExtensionDetectionBatch.update({
        where: { id: batch.id },
        data: {
          status: "undone",
          undoneAt: new Date(),
          summary: summary as unknown as Prisma.InputJsonValue,
        },
      }),
      this.prisma.browserExtensionDetectionItem.updateMany({
        where: { batchId: batch.id, applyStatus: "applied" },
        data: { applyStatus: "undone" },
      }),
      this.prisma.browserExtensionDecision.deleteMany({
        where: {
          decision: "deny",
          OR: appliedItems.map((item) => ({ target: item.target, kind: item.kind })),
        },
      }),
    ]);

    await this.audit.record({
      action: "browser_extension.detections.undo",
      actorType: "browser_extension",
      actorLabel: device.name,
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_detection_batch",
      targetId: batch.id,
      result: failed.length === 0 ? "SUCCESS" : "FAILURE",
      details: {
        summary,
        failedInstances: removal.failedInstances as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    });

    return {
      batchId: batch.id,
      status: "undone" as const,
      summary,
      removed,
      failed,
    };
  }

  async listDetections(query: GetExtensionDetectionsDto) {
    const pageSize = this.clampInteger(
      query.pageSize,
      1,
      BROWSER_EXTENSION_MAX_PAGE_SIZE,
      BROWSER_EXTENSION_DEFAULT_PAGE_SIZE,
    );
    const where = this.buildDetectionBatchWhere(query);
    const totalItems = await this.prisma.browserExtensionDetectionBatch.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(this.clampInteger(query.page, 1, 999, 1), totalPages);
    const batches = await this.prisma.browserExtensionDetectionBatch.findMany({
      where,
      include: {
        extension: true,
        items: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: batches.map((batch) => ({
        id: batch.id,
        extensionId: batch.extensionId,
        extensionName: batch.extension.name,
        clientRequestId: batch.clientRequestId,
        pageDomain: batch.pageDomain,
        pageMainDomain: batch.pageMainDomain,
        pageUrl: batch.pageUrl,
        pageTitle: batch.pageTitle,
        status: batch.status,
        summary: this.asObjectOrNull(batch.summary),
        createdAt: batch.createdAt.toISOString(),
        undoneAt: batch.undoneAt?.toISOString() ?? null,
        items: batch.items.map((item) => ({
          id: item.id,
          candidateId: item.candidateId,
          target: item.target,
          targetMainDomain: item.targetMainDomain,
          type: item.type,
          kind: item.kind,
          category: item.category,
          score: item.score,
          riskLevel: item.riskLevel,
          reasons: this.asStringArray(item.reasons),
          evidence: this.asObject(item.evidence),
          applyStatus: item.applyStatus,
          errorMessage: item.errorMessage,
        })),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async listDomainDetections(query: GetExtensionDetectionsDto) {
    const pageSize = this.clampInteger(
      query.pageSize,
      1,
      BROWSER_EXTENSION_MAX_PAGE_SIZE,
      BROWSER_EXTENSION_DEFAULT_PAGE_SIZE,
    );
    const where = this.buildDetectionBatchWhere(query);
    const allGroups = await this.prisma.browserExtensionDetectionBatch.groupBy({
      by: ["pageMainDomain"],
      where,
    });
    const totalItems = allGroups.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(this.clampInteger(query.page, 1, 999, 1), totalPages);
    const groups = await this.prisma.browserExtensionDetectionBatch.groupBy({
      by: ["pageMainDomain"],
      where,
      _max: { createdAt: true },
      orderBy: [{ _max: { createdAt: "desc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const pageMainDomains = groups.map((group) => group.pageMainDomain);

    if (pageMainDomains.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
        },
      };
    }

    const batches = await this.prisma.browserExtensionDetectionBatch.findMany({
      where: {
        ...where,
        pageMainDomain: { in: pageMainDomains },
      },
      include: {
        items: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    const blockedStatuses = new Set(["blocked", "applied"]);
    const items = pageMainDomains.map((pageMainDomain) => {
      const domainBatches = batches.filter((batch) => batch.pageMainDomain === pageMainDomain);
      const latest = domainBatches[0];

      if (!latest) {
        throw new Error(`Missing browser extension batches for ${pageMainDomain}.`);
      }

      const flatItems = domainBatches.flatMap((batch) =>
        batch.items.map((item) => ({
          id: item.id,
          batchId: batch.id,
          candidateId: item.candidateId,
          pageDomain: batch.pageDomain,
          pageUrl: batch.pageUrl,
          pageTitle: batch.pageTitle,
          detectedAt: item.createdAt.toISOString(),
          target: item.target,
          targetMainDomain: item.targetMainDomain,
          type: item.type,
          kind: item.kind,
          category: item.category,
          score: item.score,
          riskLevel: item.riskLevel,
          reasons: this.asStringArray(item.reasons),
          evidence: this.asObject(item.evidence),
          applyStatus: item.applyStatus,
          errorMessage: item.errorMessage,
        })),
      );
      const targetGroups = new Map<string, typeof flatItems>();

      for (const item of flatItems) {
        targetGroups.set(item.targetMainDomain, [...(targetGroups.get(item.targetMainDomain) ?? []), item]);
      }

      const blockedCount = flatItems.filter((item) => blockedStatuses.has(item.applyStatus)).length;
      const notBlockedCount = flatItems.length - blockedCount;

      return {
        pageMainDomain,
        latestPageDomain: latest.pageDomain,
        latestPageUrl: latest.pageUrl,
        latestPageTitle: latest.pageTitle,
        lastDetectedAt: latest.createdAt.toISOString(),
        totalDetected: flatItems.length,
        blockedCount,
        notBlockedCount,
        status: blockedCount === 0 ? "detected" : notBlockedCount === 0 ? "blocked" : "partial",
        targetGroups: [...targetGroups.entries()]
          .map(([targetMainDomain, groupItems]) => {
            const groupBlockedCount = groupItems.filter((item) => blockedStatuses.has(item.applyStatus)).length;

            return {
              targetMainDomain,
              totalDetected: groupItems.length,
              blockedCount: groupBlockedCount,
              notBlockedCount: groupItems.length - groupBlockedCount,
              items: groupItems.sort((left, right) => right.score - left.score),
            };
          })
          .sort(
            (left, right) =>
              right.blockedCount - left.blockedCount || left.targetMainDomain.localeCompare(right.targetMainDomain),
          ),
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  private async updateDetectedBatchWithApplyResult(
    batchId: string,
    dto: ApplyExtensionDetectionsDto,
    status: "applied" | "partial" | "failed",
    undoToken: string,
    summary: {
      totalTargets: number;
      appliedCount: number;
      failedCount: number;
      skippedCount: number;
    },
    persistedItems: Array<{
      candidateId: string;
      target: string;
      targetMainDomain: string;
      type: "deny";
      kind: BrowserExtensionKind;
      category: string;
      score: number;
      riskLevel: string;
      reasons: string[];
      evidence: Record<string, unknown>;
      applyStatus: "applied" | "skipped" | "failed";
      errorMessage?: string | null;
    }>,
  ) {
    const batch = await this.prisma.browserExtensionDetectionBatch.update({
      where: { id: batchId },
      data: {
        clientRequestId: dto.clientRequestId,
        pageDomain: dto.page.domain.toLowerCase(),
        pageMainDomain: getRegistrableDomainGuess(dto.page.domain),
        pageUrl: dto.page.url,
        pageTitle: dto.page.title ?? null,
        status,
        undoTokenHash: sha256Hex(undoToken),
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    });

    for (const item of persistedItems) {
      const update = await this.prisma.browserExtensionDetectionItem.updateMany({
        where: {
          batchId,
          candidateId: item.candidateId,
        },
        data: this.mapItemCreateInput(item),
      });

      if (update.count === 0) {
        await this.prisma.browserExtensionDetectionItem.create({
          data: {
            batchId,
            ...this.mapItemCreateInput(item),
          },
        });
      }
    }

    return batch;
  }

  private clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
    const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
  }

  private buildDetectionBatchWhere(query: GetExtensionDetectionsDto): Prisma.BrowserExtensionDetectionBatchWhereInput {
    const createdAt = this.buildDateFilter(query.from, query.until);

    return {
      ...(query.pageDomain
        ? {
            OR: [{ pageDomain: { contains: query.pageDomain } }, { pageMainDomain: { contains: query.pageDomain } }],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(query.target || query.category
        ? {
            items: {
              some: {
                ...(query.target
                  ? {
                      OR: [{ target: { contains: query.target } }, { targetMainDomain: { contains: query.target } }],
                    }
                  : {}),
                ...(query.category ? { category: { contains: query.category } } : {}),
              },
            },
          }
        : {}),
    };
  }

  private async recordPairAudit(
    request: Request,
    result: "SUCCESS" | "FAILURE",
    error: string | null,
    deviceId?: string,
  ) {
    await this.audit.record({
      action: "browser_extension.pair",
      actorType: "browser_extension",
      actorLabel: "YAPD Inspector",
      ipAddress: getRequestIp(request),
      targetType: "browser_extension_device",
      targetId: deviceId ?? null,
      result,
      details: error ? { error } : undefined,
    });
  }

  private async ensureSettings() {
    return this.prisma.browserExtensionSettings.upsert({
      where: { id: BROWSER_EXTENSION_SETTINGS_ID },
      update: {},
      create: { id: BROWSER_EXTENSION_SETTINGS_ID },
    });
  }

  private async readRuleCache() {
    const [decisions, managedDomains] = await Promise.all([
      this.prisma.browserExtensionDecision.findMany({
        where: { decision: { in: ["allow", "deny"] } },
        orderBy: [{ target: "asc" }],
      }),
      this.prisma.managedDomain.findMany({
        where: { type: "deny" },
        orderBy: [{ domain: "asc" }],
      }),
    ]);
    const allowlist: BrowserExtensionRuleCacheItem[] = decisions
      .filter((decision) => decision.decision === "allow")
      .map((decision) => ({
        target: decision.target,
        kind: decision.kind as BrowserExtensionKind,
        source: "browser_extension_decision",
      }));
    const blockedItems = new Map<string, BrowserExtensionRuleCacheItem>();

    for (const decision of decisions.filter((item) => item.decision === "deny")) {
      blockedItems.set(`${decision.kind}:${decision.target}`, {
        target: decision.target,
        kind: decision.kind as BrowserExtensionKind,
        source: "browser_extension_decision",
      });
    }

    for (const domain of managedDomains) {
      blockedItems.set(`${domain.kind}:${domain.domain}`, {
        target: domain.domain,
        kind: domain.kind as BrowserExtensionKind,
        source: "managed_domain",
      });
    }

    return {
      allowlist,
      blockedItems: [...blockedItems.values()],
    };
  }

  private mapSettings(settings: BrowserExtensionSettingsPayload): BrowserExtensionSettingsPayload {
    return {
      sendPageTitle: settings.sendPageTitle,
      hardBlockedUrlPatterns: settings.hardBlockedUrlPatterns,
      sensitiveUrlPatterns: settings.sensitiveUrlPatterns,
    };
  }

  private requireAuthenticatedDevice(request: BrowserExtensionAuthenticatedRequest) {
    if (!request.browserExtension) {
      throw new ForbiddenException("Browser extension authentication context is missing.");
    }

    return request.browserExtension;
  }

  private buildExtensionActorContext(
    device: BrowserExtensionAuthContext,
    request: BrowserExtensionAuthenticatedRequest,
  ): DomainOperationActorContext {
    return {
      locale: getRequestLocale(request),
      ipAddress: getRequestIp(request),
      actorType: "browser_extension",
      actorLabel: device.name,
    };
  }

  private assertValidDomainTarget(target: string, field: string) {
    const normalized = target.trim().toLowerCase();

    if (!DOMAIN_PATTERN.test(normalized) || RAW_REGEX_CHARS.test(normalized) || normalized.includes("/")) {
      throw new BadRequestException(`${field} must be a domain name. Raw regex patterns are not accepted.`);
    }
  }

  private assertValidHostTarget(target: string, field: string) {
    const normalized = target.trim().toLowerCase();

    if (
      normalized.length === 0 ||
      normalized.length > 253 ||
      normalized.includes("/") ||
      normalized.includes("\\") ||
      RAW_REGEX_CHARS.test(normalized) ||
      !/^[a-z0-9.:-]+$/i.test(normalized)
    ) {
      throw new BadRequestException(`${field} must be a hostname. Raw regex patterns are not accepted.`);
    }
  }

  private buildApplyResultItem(
    target: string,
    kind: BrowserExtensionKind,
    status: ExtensionApplyResultItem["status"],
    errorMessage?: string,
  ): ExtensionApplyResultItem {
    return {
      target,
      type: "deny",
      kind,
      status,
      ...(errorMessage ? { errorMessage } : {}),
    };
  }

  private buildPersistedItem(
    target: ApplyExtensionDetectionsDto["approvedTargets"][number],
    appliedTarget: string,
    applyStatus: "applied" | "skipped" | "failed",
    errorMessage?: string | null,
  ) {
    return {
      candidateId: target.candidateId,
      target: appliedTarget,
      targetMainDomain: getRegistrableDomainGuess(appliedTarget),
      type: target.type,
      kind: target.kind,
      category: target.category,
      score: target.score,
      riskLevel: target.riskLevel,
      reasons: target.reasons,
      evidence: {
        ...target.evidence,
        requestedTarget: target.target,
      },
      applyStatus,
      errorMessage,
    };
  }

  private mapItemCreateInput(item: {
    candidateId: string;
    target: string;
    targetMainDomain: string;
    type: string;
    kind: string;
    category: string;
    score: number;
    riskLevel: string;
    reasons: string[];
    evidence: Record<string, unknown>;
    applyStatus: string;
    errorMessage?: string | null;
  }) {
    return {
      candidateId: item.candidateId,
      target: item.target,
      targetMainDomain: item.targetMainDomain,
      type: item.type,
      kind: item.kind,
      category: item.category,
      score: item.score,
      riskLevel: item.riskLevel,
      reasons: item.reasons as unknown as Prisma.InputJsonValue,
      evidence: item.evidence as unknown as Prisma.InputJsonValue,
      applyStatus: item.applyStatus,
      errorMessage: item.errorMessage ?? null,
    };
  }

  private async upsertDenyDecision(target: string, kind: BrowserExtensionKind) {
    await this.prisma.browserExtensionDecision.upsert({
      where: {
        target_kind_decision: {
          target,
          kind,
          decision: "deny",
        },
      },
      update: {
        comment: BROWSER_EXTENSION_COMMENT_PREFIX,
      },
      create: {
        target,
        kind,
        decision: "deny",
        comment: BROWSER_EXTENSION_COMMENT_PREFIX,
      },
    });
  }

  private resolveApplyStatus(appliedCount: number, skippedCount: number, failedCount: number) {
    if (appliedCount > 0 && skippedCount === 0 && failedCount === 0) {
      return "applied" as const;
    }

    if (appliedCount > 0 || skippedCount > 0) {
      return "partial" as const;
    }

    return "failed" as const;
  }

  private joinInstanceFailures(failures: Array<{ instanceName: string; message: string }>) {
    return failures.map((failure) => `${failure.instanceName}: ${failure.message}`).join(" | ");
  }

  private buildDateFilter(from?: string, until?: string) {
    const parsedFrom = from ? new Date(from) : null;
    const parsedUntil = until ? new Date(until) : null;
    const createdAt: { gte?: Date; lte?: Date } = {};

    if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) {
      createdAt.gte = parsedFrom;
    }

    if (parsedUntil && !Number.isNaN(parsedUntil.getTime())) {
      createdAt.lte = parsedUntil;
    }

    return createdAt.gte || createdAt.lte ? createdAt : null;
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asObjectOrNull(value: unknown) {
    return value ? this.asObject(value) : null;
  }
}
