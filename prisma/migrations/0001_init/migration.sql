-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UsageEventType" AS ENUM ('CHARGE', 'TOPUP');

-- CreateEnum
CREATE TYPE "public"."TopupStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageEvent" (
    "id" TEXT NOT NULL,
    "type" "public"."UsageEventType" NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "endpoint" TEXT,
    "sourceKind" TEXT,
    "mimetype" TEXT,
    "bytes" INTEGER,
    "pages" INTEGER,
    "textChars" INTEGER,
    "pixels" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TopupInvoice" (
    "id" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "units" DECIMAL(36,18) NOT NULL,
    "credits" INTEGER NOT NULL,
    "memo" TEXT NOT NULL,
    "status" "public"."TopupStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "TopupInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "public"."ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_createdAt_idx" ON "public"."ApiKey"("createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_apiKeyId_createdAt_idx" ON "public"."UsageEvent"("apiKeyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopupInvoice_invoiceRef_key" ON "public"."TopupInvoice"("invoiceRef");

-- CreateIndex
CREATE INDEX "TopupInvoice_apiKeyId_createdAt_idx" ON "public"."TopupInvoice"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "TopupInvoice_status_createdAt_idx" ON "public"."TopupInvoice"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."UsageEvent" ADD CONSTRAINT "UsageEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TopupInvoice" ADD CONSTRAINT "TopupInvoice_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

