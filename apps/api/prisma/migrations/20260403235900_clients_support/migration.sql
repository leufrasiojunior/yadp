-- CreateTable
CREATE TABLE "ClientDevice" (
    "id" TEXT NOT NULL,
    "hwaddr" TEXT NOT NULL,
    "alias" TEXT,
    "macVendor" TEXT,
    "ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientDevice_hwaddr_key" ON "ClientDevice"("hwaddr");
