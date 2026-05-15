CREATE TABLE "OverviewAutomaticImportRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpression" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "instanceId" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunJobCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunSkippedCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverviewAutomaticImportRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OverviewAutomaticImportRule_enabled_idx" ON "OverviewAutomaticImportRule"("enabled");

CREATE INDEX "OverviewAutomaticImportRule_instanceId_idx" ON "OverviewAutomaticImportRule"("instanceId");

ALTER TABLE "OverviewAutomaticImportRule"
ADD CONSTRAINT "OverviewAutomaticImportRule_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "OverviewAutomaticImportRule" (
    "id",
    "name",
    "enabled",
    "cronExpression",
    "scope",
    "createdAt",
    "updatedAt"
)
VALUES (
    'overview-auto-import-default',
    'Importacao automatica diaria',
    true,
    '0 03 * * *',
    'all',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
