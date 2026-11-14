-- AlterTable
ALTER TABLE "OverviewAutomaticImportRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "OverviewCoverageWindow_instanceId_requestedFrom_requestedUntil_" RENAME TO "OverviewCoverageWindow_instanceId_requestedFrom_requestedUn_idx";
