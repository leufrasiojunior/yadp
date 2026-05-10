-- CreateTable
CREATE TABLE "ProductTourCompletion" (
    "id" TEXT NOT NULL,
    "browserIdHash" TEXT NOT NULL,
    "tourKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTourCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTourCompletion_browserIdHash_tourKey_key" ON "ProductTourCompletion"("browserIdHash", "tourKey");

-- CreateIndex
CREATE INDEX "ProductTourCompletion_tourKey_completedAt_idx" ON "ProductTourCompletion"("tourKey", "completedAt");
