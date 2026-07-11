import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { BrowserExtensionService } from "./browser-extension.service";
import { sha256Hex } from "./browser-extension.types";
import { BrowserExtensionAuthGuard } from "./browser-extension-auth.guard";
import { getRegistrableDomainGuess } from "./domain-utils";
import { ApplyExtensionDetectionsDto } from "./dto/apply-extension-detections.dto";
import type { PairExtensionDto } from "./dto/pair-extension.dto";
import type { ReportExtensionDetectionsDto } from "./dto/report-extension-detections.dto";
import assert from "node:assert/strict";
import test from "node:test";

function createRequest() {
  return {
    headers: {},
    ip: "127.0.0.1",
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  };
}

function createService(prismaOverrides: Record<string, unknown> = {}, domainOverrides: Record<string, unknown> = {}) {
  const audit = {
    record: async () => undefined,
  };
  const crypto = {
    createToken: () => "token-value",
  };
  const domains = {
    applyDomainOperationForActor: async () => {
      throw new Error("Domain operation should not be called by this test.");
    },
    deleteDomainsForActor: async () => ({
      failedInstances: [],
    }),
    ...domainOverrides,
  };
  const prisma = {
    browserExtensionPairingCode: {
      findUnique: async () => null,
    },
    browserExtensionDetectionBatch: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    browserExtensionDevice: {
      findUnique: async () => null,
      update: async () => null,
    },
    browserExtensionDecision: {
      findMany: async () => [],
      upsert: async () => undefined,
      deleteMany: async () => undefined,
    },
    managedDomain: {
      findMany: async () => [],
    },
    browserExtensionDetectionItem: {
      updateMany: async () => ({ count: 0 }),
      create: async () => null,
    },
    ...prismaOverrides,
  };

  return new BrowserExtensionService(audit as never, crypto as never, domains as never, prisma as never);
}

const pairDto: PairExtensionDto = {
  pairingCode: "123456",
  extensionName: "YAPD Inspector",
  browser: "chrome-or-edge",
  manifestVersion: 3,
  extensionVersion: "0.1.0",
};

const applyDto: ApplyExtensionDetectionsDto = {
  source: "browser_extension",
  extension: {
    name: "YAPD Inspector",
    extensionId: "extension-1",
    version: "0.1.0",
    browser: "chrome-or-edge",
    manifestVersion: 3,
  },
  clientRequestId: "request-1",
  page: {
    url: "https://example.com",
    domain: "example.com",
  },
  action: "apply_user_approved_detections",
  approvedTargets: [
    {
      candidateId: "candidate-1",
      target: ".*ads.*",
      type: "deny",
      kind: "regex",
      patternMode: "exact",
      category: "ads",
      score: 90,
      riskLevel: "high",
      reasons: ["Suspicious URL"],
      evidence: {
        source: "performance_resource",
        isThirdParty: true,
      },
    },
  ],
};

const reportDto: ReportExtensionDetectionsDto = {
  source: "browser_extension",
  extension: {
    name: "YAPD Inspector",
    extensionId: "extension-1",
    version: "0.1.0",
    browser: "chrome-or-edge",
    manifestVersion: 3,
  },
  clientRequestId: "scan-request-1",
  page: {
    url: "https://www.terra.com.br/noticia",
    domain: "www.terra.com.br",
  },
  action: "report_detected_items",
  detectedTargets: [
    {
      candidateId: "candidate-ads",
      target: "ads.example.com",
      category: "ads",
      score: 88,
      riskLevel: "high",
      reasons: ["Third-party resource"],
      evidence: {
        url: "https://ads.example.com/banner.js",
        source: "dom_script",
        resourceType: "script",
        isThirdParty: true,
      },
    },
  ],
};

test("getRegistrableDomainGuess preserves Brazilian registrable domains", () => {
  assert.equal(getRegistrableDomainGuess("www.terra.com.br"), "terra.com.br");
  assert.equal(getRegistrableDomainGuess("ads.example.com"), "example.com");
});

test("pairExtension rejects expired pairing codes", async () => {
  const service = createService({
    browserExtensionPairingCode: {
      findUnique: async () => ({
        id: "code-1",
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      }),
    },
  });

  await assert.rejects(() => service.pairExtension(pairDto, createRequest() as never), BadRequestException);
});

test("pairExtension rejects already used pairing codes", async () => {
  const service = createService({
    browserExtensionPairingCode: {
      findUnique: async () => ({
        id: "code-1",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      }),
    },
  });

  await assert.rejects(() => service.pairExtension(pairDto, createRequest() as never), BadRequestException);
});

test("ApplyExtensionDetectionsDto rejects empty target lists", async () => {
  const dto = plainToInstance(ApplyExtensionDetectionsDto, {
    ...applyDto,
    approvedTargets: [],
  });
  const errors = await validate(dto);

  assert.equal(
    errors.some((error) => error.property === "approvedTargets"),
    true,
  );
});

test("applyDetections rejects raw regex targets before applying domains", async () => {
  const service = createService({
    browserExtensionDetectionBatch: {
      findUnique: async () => null,
    },
  });
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };

  await assert.rejects(() => service.applyDetections(applyDto, request as never), BadRequestException);
});

test("reportDetections creates a detected batch grouped by registrable domains", async () => {
  let createdData: Record<string, unknown> | undefined;
  const service = createService({
    browserExtensionDetectionBatch: {
      findUnique: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        createdData = args.data;
        return { id: "batch-report-1" };
      },
    },
    browserExtensionDecision: {
      findMany: async () => [
        {
          target: "ads.example.com",
          kind: "exact",
          decision: "deny",
        },
      ],
    },
    managedDomain: {
      findMany: async () => [],
    },
  });
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };

  const response = await service.reportDetections(reportDto, request as never);

  assert.equal(response.batchId, "batch-report-1");
  assert.equal(response.status, "detected");
  assert.equal(createdData?.pageMainDomain, "terra.com.br");
  const createItems = createdData?.items as { create: Array<Record<string, unknown>> };
  assert.equal(createItems.create[0]?.targetMainDomain, "example.com");
  assert.equal(createItems.create[0]?.applyStatus, "blocked");
});

test("applyDetections updates an existing detected source batch", async () => {
  let updatedBatchData: Record<string, unknown> | undefined;
  let updatedItemData: Record<string, unknown> | undefined;
  const service = createService(
    {
      browserExtensionDetectionBatch: {
        findUnique: async (args: { where: { clientRequestId?: string; id?: string } }) => {
          if (args.where.clientRequestId) {
            return null;
          }

          return {
            id: "batch-report-1",
            extensionId: "extension-1",
            pageDomain: "example.com",
            status: "detected",
            undoTokenHash: null,
          };
        },
        update: async (args: { data: Record<string, unknown> }) => {
          updatedBatchData = args.data;
          return { id: "batch-report-1" };
        },
      },
      browserExtensionDetectionItem: {
        updateMany: async (args: { data: Record<string, unknown> }) => {
          updatedItemData = args.data;
          return { count: 1 };
        },
        create: async () => {
          throw new Error("Existing detected item should be updated.");
        },
      },
      browserExtensionDecision: {
        upsert: async () => undefined,
      },
    },
    {
      applyDomainOperationForActor: async () => ({
        request: { value: "ads.example.com" },
        successfulInstances: [{ instanceName: "Pi-hole" }],
        failedInstances: [],
      }),
    },
  );
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };
  const approvedTarget = applyDto.approvedTargets[0];

  assert.ok(approvedTarget);

  const dto: ApplyExtensionDetectionsDto = {
    ...applyDto,
    clientRequestId: "apply-request-1",
    sourceBatchId: "batch-report-1",
    approvedTargets: [
      {
        ...approvedTarget,
        target: "ads.example.com",
        kind: "exact",
        patternMode: undefined,
      },
    ],
  };

  const response = await service.applyDetections(dto, request as never);

  assert.equal(response.batchId, "batch-report-1");
  assert.equal(updatedBatchData?.clientRequestId, "apply-request-1");
  assert.equal(updatedBatchData?.pageMainDomain, "example.com");
  assert.equal(updatedItemData?.targetMainDomain, "example.com");
  assert.equal(updatedItemData?.applyStatus, "applied");
});

test("undoLast rejects batches owned by another extension", async () => {
  const service = createService({
    browserExtensionDetectionBatch: {
      findUnique: async () => ({
        id: "batch-1",
        extensionId: "other-extension",
        status: "applied",
        undoTokenHash: sha256Hex("undo"),
        items: [],
      }),
    },
  });
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };

  await assert.rejects(
    () => service.undoLast({ batchId: "batch-1", undoToken: "undo" }, request as never),
    NotFoundException,
  );
});

test("undoLast rejects batches already marked undone", async () => {
  const service = createService({
    browserExtensionDetectionBatch: {
      findUnique: async () => ({
        id: "batch-1",
        extensionId: "extension-1",
        status: "undone",
        undoTokenHash: sha256Hex("undo"),
        items: [],
      }),
    },
  });
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };

  await assert.rejects(
    () => service.undoLast({ batchId: "batch-1", undoToken: "undo" }, request as never),
    BadRequestException,
  );
});

test("listDetections coerces query pagination values before calling Prisma", async () => {
  let receivedTake: unknown;
  let receivedSkip: unknown;
  const service = createService({
    browserExtensionDetectionBatch: {
      count: async () => 0,
      findMany: async (args: { take: unknown; skip: unknown }) => {
        receivedTake = args.take;
        receivedSkip = args.skip;
        return [];
      },
    },
  });

  const response = await service.listDetections({ page: "1", pageSize: "10" } as never);

  assert.equal(receivedTake, 10);
  assert.equal(receivedSkip, 0);
  assert.equal(response.pagination.pageSize, 10);
});

test("undoLast rejects batches that are not the latest for the authenticated extension", async () => {
  let latestWhere: unknown;
  const service = createService({
    browserExtensionDetectionBatch: {
      findUnique: async () => ({
        id: "batch-1",
        extensionId: "extension-1",
        status: "applied",
        undoTokenHash: sha256Hex("undo"),
        items: [],
      }),
      findFirst: async (args: { where: unknown }) => {
        latestWhere = args.where;
        return {
          id: "batch-2",
        };
      },
    },
  });
  const request = {
    ...createRequest(),
    browserExtension: {
      id: "extension-1",
      name: "YAPD Inspector",
      browser: "chrome-or-edge",
      manifestVersion: 3,
      extensionVersion: "0.1.0",
      tokenPrefix: "token",
    },
  };

  await assert.rejects(
    () => service.undoLast({ batchId: "batch-1", undoToken: "undo" }, request as never),
    BadRequestException,
  );
  assert.deepEqual(latestWhere, {
    extensionId: "extension-1",
    undoTokenHash: { not: null },
  });
});

test("revokeDevice marks an active device as revoked", async () => {
  const revokedAt = new Date();
  const service = createService({
    browserExtensionDevice: {
      findUnique: async () => ({
        id: "extension-1",
        tokenPrefix: "token",
        revokedAt: null,
      }),
      update: async () => ({
        id: "extension-1",
        tokenPrefix: "token",
        revokedAt,
      }),
    },
  });

  const response = await service.revokeDevice("extension-1", createRequest() as never);

  assert.equal(response.id, "extension-1");
  assert.equal(Number.isNaN(new Date(response.revokedAt).getTime()), false);
});

test("BrowserExtensionAuthGuard accepts a valid bearer token and attaches scoped context", async () => {
  const token = "valid-token";
  const tokenHash = sha256Hex(token);
  const request = {
    headers: { authorization: `Bearer ${token}` },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  };
  const guard = new BrowserExtensionAuthGuard({
    browserExtensionDevice: {
      findUnique: async () => ({
        id: "extension-1",
        name: "YAPD Inspector",
        browser: "chrome-or-edge",
        manifestVersion: 3,
        extensionVersion: "0.1.0",
        tokenPrefix: "valid-to",
        tokenHash,
        revokedAt: null,
      }),
      update: async () => undefined,
    },
  } as never);
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };

  assert.equal(await guard.canActivate(context as never), true);
  assert.equal(request.browserExtension.id, "extension-1");
});

test("BrowserExtensionAuthGuard rejects invalid bearer tokens", async () => {
  const request = {
    headers: { authorization: "Bearer invalid-token" },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  };
  const guard = new BrowserExtensionAuthGuard({
    browserExtensionDevice: {
      findUnique: async () => null,
    },
  } as never);
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});
