ALTER TABLE "SyncOperationPreset"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Saved preset',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 1000;

DROP INDEX IF EXISTS "SyncOperationPreset_operationKey_key";

UPDATE "SyncOperationPreset"
SET
  "name" = CASE
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 10 THEN '10s'
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 30 THEN '30s'
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 300 THEN '5m'
    ELSE 'Saved preset'
  END,
  "sortOrder" = CASE
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 10 THEN 10
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 30 THEN 20
    WHEN "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 300 THEN 30
    ELSE 1000
  END;

INSERT INTO "SyncOperationPreset" ("id", "operationKey", "name", "timerSeconds", "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), 'BLOCKING'::"SyncOperationKey", '10s', 10, 10, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "SyncOperationPreset"
  WHERE "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 10
);

INSERT INTO "SyncOperationPreset" ("id", "operationKey", "name", "timerSeconds", "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), 'BLOCKING'::"SyncOperationKey", '30s', 30, 20, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "SyncOperationPreset"
  WHERE "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 30
);

INSERT INTO "SyncOperationPreset" ("id", "operationKey", "name", "timerSeconds", "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), 'BLOCKING'::"SyncOperationKey", '5m', 300, 30, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "SyncOperationPreset"
  WHERE "operationKey" = 'BLOCKING'::"SyncOperationKey" AND "timerSeconds" = 300
);

CREATE UNIQUE INDEX "SyncOperationPreset_operationKey_sortOrder_key"
ON "SyncOperationPreset"("operationKey", "sortOrder");
