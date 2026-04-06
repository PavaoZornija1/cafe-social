-- CreateEnum
CREATE TYPE "VenueOfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "VenueOffer" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "ctaUrl" TEXT,
    "status" "VenueOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerPlayer" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueOfferRedemption" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueOfferRedemption_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy featured-offer columns into VenueOffer (one row per venue that had a title).
INSERT INTO "VenueOffer" (
    "id",
    "venueId",
    "title",
    "body",
    "imageUrl",
    "ctaUrl",
    "status",
    "isFeatured",
    "validFrom",
    "validTo",
    "maxRedemptions",
    "maxRedemptionsPerPlayer",
    "redemptionCount",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    v."id",
    TRIM(v."featuredOfferTitle"),
    v."featuredOfferBody",
    NULL,
    NULL,
    'ACTIVE',
    true,
    NULL,
    v."featuredOfferEndsAt",
    NULL,
    1,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Venue" v
WHERE v."featuredOfferTitle" IS NOT NULL
  AND TRIM(v."featuredOfferTitle") <> '';

-- Drop legacy columns from Venue
ALTER TABLE "Venue" DROP COLUMN "featuredOfferTitle",
DROP COLUMN "featuredOfferBody",
DROP COLUMN "featuredOfferEndsAt";

-- CreateIndex
CREATE INDEX "VenueOffer_venueId_idx" ON "VenueOffer"("venueId");

-- CreateIndex
CREATE INDEX "VenueOffer_venueId_status_idx" ON "VenueOffer"("venueId", "status");

-- CreateIndex
CREATE INDEX "VenueOfferRedemption_offerId_idx" ON "VenueOfferRedemption"("offerId");

-- CreateIndex
CREATE INDEX "VenueOfferRedemption_playerId_idx" ON "VenueOfferRedemption"("playerId");

-- AddForeignKey
ALTER TABLE "VenueOffer" ADD CONSTRAINT "VenueOffer_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOfferRedemption" ADD CONSTRAINT "VenueOfferRedemption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "VenueOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOfferRedemption" ADD CONSTRAINT "VenueOfferRedemption_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
