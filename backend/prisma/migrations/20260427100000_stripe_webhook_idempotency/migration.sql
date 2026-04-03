-- AlterTable
ALTER TABLE "VenueOrganization" ADD COLUMN "platformBillingSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StripeProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StripeProcessedWebhookEvent_createdAt_idx" ON "StripeProcessedWebhookEvent"("createdAt");
