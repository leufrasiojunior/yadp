-- Add ciphered auth column and relax the plaintext column to nullable so
-- existing rows keep working while NotificationsService lazily migrates
-- them on first read. A follow-up migration will drop "auth" once we are
-- confident every deployed instance has finished the backfill.

-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN "authCipher" TEXT;

-- AlterTable
ALTER TABLE "PushSubscription" ALTER COLUMN "auth" DROP NOT NULL;
