-- AlterTable
ALTER TABLE "VenueReceiptSubmission" ADD COLUMN "linkedRedemptionId" TEXT;

-- CreateIndex
CREATE INDEX "VenueReceiptSubmission_linkedRedemptionId_idx" ON "VenueReceiptSubmission"("linkedRedemptionId");

-- AddForeignKey
ALTER TABLE "VenueReceiptSubmission" ADD CONSTRAINT "VenueReceiptSubmission_linkedRedemptionId_fkey" FOREIGN KEY ("linkedRedemptionId") REFERENCES "VenuePerkRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "BrawlerMatchQueueEntry" ADD COLUMN "partyId" TEXT;

-- CreateIndex
CREATE INDEX "BrawlerMatchQueueEntry_partyId_idx" ON "BrawlerMatchQueueEntry"("partyId");

-- CreateIndex
CREATE INDEX "BrawlerMatchQueueEntry_party_bucket_idx" ON "BrawlerMatchQueueEntry"("partyId", "ranked", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "BrawlerMatchQueueEntry" ADD CONSTRAINT "BrawlerMatchQueueEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
