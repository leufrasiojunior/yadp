-- CreateTable
CREATE TABLE "BrowserExtensionDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "manifestVersion" INTEGER NOT NULL,
    "extensionVersion" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserExtensionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserExtensionPairingCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserExtensionPairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserExtensionSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "sendPageTitle" BOOLEAN NOT NULL DEFAULT false,
    "hardBlockedUrlPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sensitiveUrlPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserExtensionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserExtensionDecision" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserExtensionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserExtensionDetectionBatch" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "pageDomain" TEXT NOT NULL,
    "pageUrl" TEXT,
    "pageTitle" TEXT,
    "status" TEXT NOT NULL,
    "undoTokenHash" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "BrowserExtensionDetectionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserExtensionDetectionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "applyStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserExtensionDetectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserExtensionDevice_tokenHash_key" ON "BrowserExtensionDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "BrowserExtensionDevice_revokedAt_idx" ON "BrowserExtensionDevice"("revokedAt");

-- CreateIndex
CREATE INDEX "BrowserExtensionDevice_lastSeenAt_idx" ON "BrowserExtensionDevice"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserExtensionPairingCode_codeHash_key" ON "BrowserExtensionPairingCode"("codeHash");

-- CreateIndex
CREATE INDEX "BrowserExtensionPairingCode_expiresAt_idx" ON "BrowserExtensionPairingCode"("expiresAt");

-- CreateIndex
CREATE INDEX "BrowserExtensionPairingCode_usedAt_idx" ON "BrowserExtensionPairingCode"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserExtensionDecision_target_kind_decision_key" ON "BrowserExtensionDecision"("target", "kind", "decision");

-- CreateIndex
CREATE INDEX "BrowserExtensionDecision_target_idx" ON "BrowserExtensionDecision"("target");

-- CreateIndex
CREATE INDEX "BrowserExtensionDecision_decision_idx" ON "BrowserExtensionDecision"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserExtensionDetectionBatch_clientRequestId_key" ON "BrowserExtensionDetectionBatch"("clientRequestId");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionBatch_extensionId_createdAt_idx" ON "BrowserExtensionDetectionBatch"("extensionId", "createdAt");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionBatch_pageDomain_createdAt_idx" ON "BrowserExtensionDetectionBatch"("pageDomain", "createdAt");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionBatch_status_idx" ON "BrowserExtensionDetectionBatch"("status");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionItem_target_idx" ON "BrowserExtensionDetectionItem"("target");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionItem_category_idx" ON "BrowserExtensionDetectionItem"("category");

-- CreateIndex
CREATE INDEX "BrowserExtensionDetectionItem_applyStatus_idx" ON "BrowserExtensionDetectionItem"("applyStatus");

-- AddForeignKey
ALTER TABLE "BrowserExtensionDetectionBatch" ADD CONSTRAINT "BrowserExtensionDetectionBatch_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "BrowserExtensionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserExtensionDetectionItem" ADD CONSTRAINT "BrowserExtensionDetectionItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BrowserExtensionDetectionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
