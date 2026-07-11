ALTER TABLE "BrowserExtensionDetectionBatch" ADD COLUMN "pageMainDomain" TEXT;
UPDATE "BrowserExtensionDetectionBatch" SET "pageMainDomain" = "pageDomain";
ALTER TABLE "BrowserExtensionDetectionBatch" ALTER COLUMN "pageMainDomain" SET NOT NULL;

ALTER TABLE "BrowserExtensionDetectionItem" ADD COLUMN "targetMainDomain" TEXT;
UPDATE "BrowserExtensionDetectionItem" SET "targetMainDomain" = "target";
ALTER TABLE "BrowserExtensionDetectionItem" ALTER COLUMN "targetMainDomain" SET NOT NULL;

CREATE INDEX "BrowserExtensionDetectionBatch_pageMainDomain_createdAt_idx" ON "BrowserExtensionDetectionBatch"("pageMainDomain", "createdAt");
CREATE INDEX "BrowserExtensionDetectionItem_targetMainDomain_idx" ON "BrowserExtensionDetectionItem"("targetMainDomain");
