-- DropForeignKey
ALTER TABLE "OverviewCoverageWindow" DROP CONSTRAINT "OverviewCoverageWindow_jobId_fkey";

-- AlterTable
ALTER TABLE "OverviewCoverageWindow" ALTER COLUMN "jobId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OverviewCoverageWindow"
ADD CONSTRAINT "OverviewCoverageWindow_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "OverviewHistoryJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
