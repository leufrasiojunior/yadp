-- CreateTable
CREATE TABLE "ConfigSyncIgnoreRule" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigSyncIgnoreRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigSyncIgnoreRule_topic_fieldPath_key" ON "ConfigSyncIgnoreRule"("topic", "fieldPath");
