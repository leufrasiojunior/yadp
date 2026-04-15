-- CreateTable
CREATE TABLE "ClientGroup" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientGroupMembership" (
    "groupId" INTEGER NOT NULL,
    "instanceId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "clientDeviceId" TEXT,
    "rawClientValue" TEXT,
    "rawClientName" TEXT,
    "resolvedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientGroupMembership_pkey" PRIMARY KEY ("groupId","instanceId","clientKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientGroup_name_key" ON "ClientGroup"("name");

-- CreateIndex
CREATE INDEX "ClientGroupMembership_instanceId_groupId_idx" ON "ClientGroupMembership"("instanceId", "groupId");

-- CreateIndex
CREATE INDEX "ClientGroupMembership_clientDeviceId_idx" ON "ClientGroupMembership"("clientDeviceId");

-- AddForeignKey
ALTER TABLE "ClientGroupMembership" ADD CONSTRAINT "ClientGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClientGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroupMembership" ADD CONSTRAINT "ClientGroupMembership_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroupMembership" ADD CONSTRAINT "ClientGroupMembership_clientDeviceId_fkey" FOREIGN KEY ("clientDeviceId") REFERENCES "ClientDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
