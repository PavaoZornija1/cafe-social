-- AlterTable Venue
ALTER TABLE "Venue" ADD COLUMN "menuUrl" TEXT,
ADD COLUMN "orderingUrl" TEXT,
ADD COLUMN "featuredOfferTitle" TEXT,
ADD COLUMN "featuredOfferBody" TEXT,
ADD COLUMN "featuredOfferEndsAt" TIMESTAMP(3);

-- AlterTable Player
ALTER TABLE "Player" ADD COLUMN "partnerMarketingPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "matchActivityPush" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Challenge
ALTER TABLE "Challenge" ADD COLUMN "activeFrom" TIMESTAMP(3),
ADD COLUMN "activeTo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlayerVenueVisitDay" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerVenueVisitDay_pkey" PRIMARY KEY ("playerId","venueId","dayKey")
);

CREATE INDEX "PlayerVenueVisitDay_venueId_dayKey_idx" ON "PlayerVenueVisitDay"("venueId", "dayKey");
CREATE INDEX "PlayerVenueVisitDay_playerId_dayKey_idx" ON "PlayerVenueVisitDay"("playerId", "dayKey");

ALTER TABLE "PlayerVenueVisitDay" ADD CONSTRAINT "PlayerVenueVisitDay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerVenueVisitDay" ADD CONSTRAINT "PlayerVenueVisitDay_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable VenuePerk
CREATE TABLE "VenuePerk" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "requiresQrUnlock" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenuePerk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenuePerk_code_key" ON "VenuePerk"("code");
CREATE INDEX "VenuePerk_venueId_idx" ON "VenuePerk"("venueId");

ALTER TABLE "VenuePerk" ADD CONSTRAINT "VenuePerk_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VenuePerkRedemption" (
    "id" TEXT NOT NULL,
    "perkId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenuePerkRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenuePerkRedemption_perkId_playerId_key" ON "VenuePerkRedemption"("perkId", "playerId");
CREATE INDEX "VenuePerkRedemption_playerId_idx" ON "VenuePerkRedemption"("playerId");
CREATE INDEX "VenuePerkRedemption_venueId_idx" ON "VenuePerkRedemption"("venueId");

ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_perkId_fkey" FOREIGN KEY ("perkId") REFERENCES "VenuePerk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
