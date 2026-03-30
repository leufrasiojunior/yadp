-- CreateEnum
CREATE TYPE "SyncOperationKey" AS ENUM ('BLOCKING');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateEnum
CREATE TYPE "SyncAttemptStatus" AS ENUM ('SUCCESS', 'FAILURE', 'NOOP', 'SKIPPED');

-- CreateTable
CREATE TABLE "SyncOperationPreset" (
    "id" TEXT NOT NULL,
    "operationKey" "SyncOperationKey" NOT NULL,
    "timerSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncOperationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "operationKey" "SyncOperationKey" NOT NULL,
    "scope" TEXT NOT NULL,
    "requestedConfig" JSONB NOT NULL,
    "status" "SyncJobStatus" NOT NULL,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncAttempt" (
    "id" TEXT NOT NULL,
    "syncJobId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SyncAttemptStatus" NOT NULL,
    "message" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperationPreset_operationKey_key" ON "SyncOperationPreset"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAttempt_syncJobId_instanceId_attemptNumber_key" ON "SyncAttempt"("syncJobId", "instanceId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "SyncAttempt" ADD CONSTRAINT "SyncAttempt_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAttempt" ADD CONSTRAINT "SyncAttempt_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
