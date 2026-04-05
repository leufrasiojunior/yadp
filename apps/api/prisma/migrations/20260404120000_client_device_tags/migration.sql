-- AlterTable
ALTER TABLE "ClientDevice"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
