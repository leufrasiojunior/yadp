-- CreateEnum
CREATE TYPE "CertificateTrustMode" AS ENUM ('STRICT', 'CUSTOM_CA', 'ALLOW_SELF_SIGNED');

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),
    "lastKnownVersion" TEXT,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceSecret" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceCertificateTrust" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "mode" "CertificateTrustMode" NOT NULL DEFAULT 'STRICT',
    "certificatePem" TEXT,
    "fingerprintSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceCertificateTrust_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorLabel" TEXT,
    "ipAddress" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "result" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSecret_instanceId_key" ON "InstanceSecret"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceCertificateTrust_instanceId_key" ON "InstanceCertificateTrust"("instanceId");

-- AddForeignKey
ALTER TABLE "InstanceSecret" ADD CONSTRAINT "InstanceSecret_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceCertificateTrust" ADD CONSTRAINT "InstanceCertificateTrust_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
