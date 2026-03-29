-- CreateEnum
CREATE TYPE "AppLoginMode" AS ENUM ('PIHOLE_MASTER', 'YAPD_PASSWORD');

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "loginMode" "AppLoginMode" NOT NULL DEFAULT 'PIHOLE_MASTER',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
