-- CreateEnum
CREATE TYPE "InstanceSessionAuthSource" AS ENUM ('HUMAN_MASTER', 'STORED_SECRET');

-- CreateTable
CREATE TABLE "InstanceSession" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "encryptedSid" TEXT NOT NULL,
    "encryptedCsrf" TEXT NOT NULL,
    "piholeSessionId" INTEGER,
    "loginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "authSource" "InstanceSessionAuthSource" NOT NULL,
    "lastErrorKind" TEXT,
    "lastErrorMessage" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSession_instanceId_key" ON "InstanceSession"("instanceId");

-- AddForeignKey
ALTER TABLE "InstanceSession" ADD CONSTRAINT "InstanceSession_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
