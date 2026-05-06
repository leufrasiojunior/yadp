-- CreateTable
CREATE TABLE "ManagedList" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "comment" TEXT,
    "type" TEXT NOT NULL DEFAULT 'block',
    "groups" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedList_address_key" ON "ManagedList"("address");
