-- AlterTable
ALTER TABLE "VenueOfferRedemption" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);
