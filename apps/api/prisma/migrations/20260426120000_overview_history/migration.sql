-- CreateEnum
CREATE TYPE "OverviewHistoryJobKind" AS ENUM ('AUTOMATIC_IMPORT', 'MANUAL_IMPORT', 'MANUAL_DELETE');

-- CreateEnum
CREATE TYPE "OverviewHistoryJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateTable
CREATE TABLE "OverviewHistoryJob" (
    "id" TEXT NOT NULL,
    "kind" "OverviewHistoryJobKind" NOT NULL,
    "scope" TEXT NOT NULL,
    "instanceId" TEXT,
    "instanceNameSnapshot" TEXT,
    "requestedFrom" TIMESTAMP(3) NOT NULL,
    "requestedUntil" TIMESTAMP(3) NOT NULL,
    "status" "OverviewHistoryJobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT,
    "requestedBy" TEXT,
    "summary" JSONB,
    "errorMessage" TEXT,
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "coverageCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverviewHistoryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalQuery" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "instanceId" TEXT NOT NULL,
    "instanceNameSnapshot" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "domain" TEXT,
    "clientIp" TEXT,
    "clientName" TEXT,
    "clientAlias" TEXT,
    "upstream" TEXT,
    "queryType" TEXT,
    "status" TEXT,
    "dnssec" TEXT,
    "replyType" TEXT,
    "replyTime" INTEGER,
    "listId" INTEGER,
    "edeCode" INTEGER,
    "edeText" TEXT,
    "cname" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverviewCoverageWindow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "requestedFrom" TIMESTAMP(3) NOT NULL,
    "requestedUntil" TIMESTAMP(3) NOT NULL,
    "storedFrom" TIMESTAMP(3),
    "storedUntil" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" "OverviewHistoryJobStatus" NOT NULL,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverviewCoverageWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OverviewHistoryJob_status_createdAt_idx" ON "OverviewHistoryJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OverviewHistoryJob_kind_createdAt_idx" ON "OverviewHistoryJob"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "OverviewHistoryJob_requestedFrom_requestedUntil_idx" ON "OverviewHistoryJob"("requestedFrom", "requestedUntil");

-- CreateIndex
CREATE INDEX "OverviewHistoryJob_instanceId_createdAt_idx" ON "OverviewHistoryJob"("instanceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalQuery_instanceId_sourceId_occurredAt_key" ON "HistoricalQuery"("instanceId", "sourceId", "occurredAt");

-- CreateIndex
CREATE INDEX "HistoricalQuery_occurredAt_idx" ON "HistoricalQuery"("occurredAt");

-- CreateIndex
CREATE INDEX "HistoricalQuery_instanceId_occurredAt_idx" ON "HistoricalQuery"("instanceId", "occurredAt");

-- CreateIndex
CREATE INDEX "HistoricalQuery_domain_idx" ON "HistoricalQuery"("domain");

-- CreateIndex
CREATE INDEX "HistoricalQuery_clientIp_idx" ON "HistoricalQuery"("clientIp");

-- CreateIndex
CREATE INDEX "HistoricalQuery_status_idx" ON "HistoricalQuery"("status");

-- CreateIndex
CREATE INDEX "HistoricalQuery_expiresAt_idx" ON "HistoricalQuery"("expiresAt");

-- CreateIndex
CREATE INDEX "HistoricalQuery_jobId_idx" ON "HistoricalQuery"("jobId");

-- CreateIndex
CREATE INDEX "OverviewCoverageWindow_instanceId_requestedFrom_requestedUntil_idx" ON "OverviewCoverageWindow"("instanceId", "requestedFrom", "requestedUntil");

-- CreateIndex
CREATE INDEX "OverviewCoverageWindow_jobId_idx" ON "OverviewCoverageWindow"("jobId");

-- CreateIndex
CREATE INDEX "OverviewCoverageWindow_expiresAt_idx" ON "OverviewCoverageWindow"("expiresAt");

-- AddForeignKey
ALTER TABLE "OverviewHistoryJob" ADD CONSTRAINT "OverviewHistoryJob_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalQuery" ADD CONSTRAINT "HistoricalQuery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OverviewHistoryJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalQuery" ADD CONSTRAINT "HistoricalQuery_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverviewCoverageWindow" ADD CONSTRAINT "OverviewCoverageWindow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OverviewHistoryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverviewCoverageWindow" ADD CONSTRAINT "OverviewCoverageWindow_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
