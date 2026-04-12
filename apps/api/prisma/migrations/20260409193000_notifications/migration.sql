CREATE TYPE "NotificationState" AS ENUM ('ACTIVE', 'RESOLVED');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instanceId" TEXT,
    "instanceNameSnapshot" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "state" "NotificationState" NOT NULL DEFAULT 'ACTIVE',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "sourceFingerprint" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "deleteRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_sourceFingerprint_idx" ON "Notification"("sourceFingerprint");
CREATE INDEX "Notification_hiddenAt_resolvedAt_occurredAt_idx" ON "Notification"("hiddenAt", "resolvedAt", "occurredAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "PushSubscription_disabledAt_idx" ON "PushSubscription"("disabledAt");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
