ALTER TABLE "AppConfig"
ADD COLUMN "webPushVapidPublicKey" TEXT,
ADD COLUMN "webPushVapidPrivateKeyEncrypted" TEXT,
ADD COLUMN "webPushVapidSubject" TEXT;
