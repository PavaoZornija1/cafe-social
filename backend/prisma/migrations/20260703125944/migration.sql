-- DropForeignKey
ALTER TABLE "VenueReceiptSubmission" DROP CONSTRAINT "VenueReceiptSubmission_linkedRedemptionId_fkey";

-- DropIndex
DROP INDEX "BrawlerMatchQueueEntry_partyId_idx";

-- DropIndex
DROP INDEX "VenueReceiptSubmission_linkedRedemptionId_idx";

-- DropIndex
DROP INDEX "WordMatchQueueEntry_partyId_idx";
