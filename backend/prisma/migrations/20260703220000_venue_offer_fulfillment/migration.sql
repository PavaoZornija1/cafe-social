-- CreateEnum
CREATE TYPE "VenueOfferFulfillment" AS ENUM ('AUTO', 'MEMBER_CARD');

-- AlterTable
ALTER TABLE "VenueOffer" ADD COLUMN "fulfillment" "VenueOfferFulfillment" NOT NULL DEFAULT 'MEMBER_CARD';
ALTER TABLE "VenueOffer" ADD COLUMN "autoXpMultiplier" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VenueOfferRedemption" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "VenueOfferRedemption" ADD COLUMN "fulfilledAt" TIMESTAMP(3);
ALTER TABLE "VenueOfferRedemption" ADD COLUMN "fulfilledByStaffPlayerId" TEXT;

-- Existing ledger rows were self-serve claims; treat as already honoured.
UPDATE "VenueOfferRedemption" SET "status" = 'FULFILLED', "fulfilledAt" = "createdAt" WHERE "status" = 'PENDING';

CREATE INDEX "VenueOfferRedemption_playerId_status_idx" ON "VenueOfferRedemption"("playerId", "status");
