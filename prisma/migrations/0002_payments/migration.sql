-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- Add indexes/constraints to TopupInvoice
CREATE UNIQUE INDEX IF NOT EXISTS "TopupInvoice_txHash_key" ON "public"."TopupInvoice"("txHash");
CREATE INDEX IF NOT EXISTS "TopupInvoice_chain_asset_createdAt_idx" ON "public"."TopupInvoice"("chain", "asset", "createdAt");

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'UNMATCHED',
    "invoiceRef" TEXT,
    "raw" JSONB,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txHash_key" ON "public"."Payment"("txHash");
CREATE INDEX "Payment_status_seenAt_idx" ON "public"."Payment"("status", "seenAt");
CREATE INDEX "Payment_chain_asset_toAddress_seenAt_idx" ON "public"."Payment"("chain", "asset", "toAddress", "seenAt");
CREATE INDEX "Payment_invoiceRef_idx" ON "public"."Payment"("invoiceRef");
