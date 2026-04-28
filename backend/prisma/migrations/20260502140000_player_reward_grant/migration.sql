-- Orchestrated reward issuance (challenge, future campaign actions). Compositional campaign links.
CREATE TABLE "PlayerRewardGrant" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "perkId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRewardGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerRewardGrant_idempotencyKey_key" ON "PlayerRewardGrant"("idempotencyKey");
CREATE INDEX "PlayerRewardGrant_playerId_idx" ON "PlayerRewardGrant"("playerId");
CREATE INDEX "PlayerRewardGrant_venueId_idx" ON "PlayerRewardGrant"("venueId");
CREATE INDEX "PlayerRewardGrant_sourceType_sourceId_idx" ON "PlayerRewardGrant"("sourceType", "sourceId");

ALTER TABLE "PlayerRewardGrant" ADD CONSTRAINT "PlayerRewardGrant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerRewardGrant" ADD CONSTRAINT "PlayerRewardGrant_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerRewardGrant" ADD CONSTRAINT "PlayerRewardGrant_perkId_fkey" FOREIGN KEY ("perkId") REFERENCES "VenuePerk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VenueCampaignBinding" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueCampaignBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueCampaignBinding_campaignId_entityType_entityId_key" ON "VenueCampaignBinding"("campaignId", "entityType", "entityId");
CREATE INDEX "VenueCampaignBinding_campaignId_idx" ON "VenueCampaignBinding"("campaignId");

ALTER TABLE "VenueCampaignBinding" ADD CONSTRAINT "VenueCampaignBinding_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "VenueCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow multiple perk claims per player; link orchestrated rows to grants.
ALTER TABLE "VenuePerkRedemption" ADD COLUMN "playerRewardGrantId" TEXT;

CREATE UNIQUE INDEX "VenuePerkRedemption_playerRewardGrantId_key" ON "VenuePerkRedemption"("playerRewardGrantId");

ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_playerRewardGrantId_fkey" FOREIGN KEY ("playerRewardGrantId") REFERENCES "PlayerRewardGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "VenuePerkRedemption_perkId_playerId_key";

CREATE INDEX "VenuePerkRedemption_perkId_playerId_idx" ON "VenuePerkRedemption"("perkId", "playerId");
