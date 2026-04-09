-- CreateTable
CREATE TABLE "ManagedDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "comment" TEXT,
    "groups" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegexFilter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegexFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedDomain_domain_type_kind_key" ON "ManagedDomain"("domain", "type", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RegexFilter_name_key" ON "RegexFilter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RegexFilter_pattern_key" ON "RegexFilter"("pattern");
