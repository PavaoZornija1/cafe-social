-- Per-venue / org guest daily game caps; funnel events; player reports & venue bans.

ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VenueOrganization" ADD COLUMN "guestPlayDailyGamesLimit" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "guestPlayDailyGamesLimit" INTEGER;

CREATE TABLE "VenueFunnelEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueFunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueFunnelEvent_venueId_kind_createdAt_idx" ON "VenueFunnelEvent"("venueId", "kind", "createdAt");
CREATE INDEX "VenueFunnelEvent_playerId_createdAt_idx" ON "VenueFunnelEvent"("playerId", "createdAt");

ALTER TABLE "VenueFunnelEvent" ADD CONSTRAINT "VenueFunnelEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueFunnelEvent" ADD CONSTRAINT "VenueFunnelEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VenuePlayerReport" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedPlayerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "VenuePlayerReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenuePlayerReport_venueId_createdAt_idx" ON "VenuePlayerReport"("venueId", "createdAt");
CREATE INDEX "VenuePlayerReport_reportedPlayerId_idx" ON "VenuePlayerReport"("reportedPlayerId");

ALTER TABLE "VenuePlayerReport" ADD CONSTRAINT "VenuePlayerReport_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenuePlayerReport" ADD CONSTRAINT "VenuePlayerReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenuePlayerReport" ADD CONSTRAINT "VenuePlayerReport_reportedPlayerId_fkey" FOREIGN KEY ("reportedPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VenuePlayerBan" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT,
    "createdByStaffPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenuePlayerBan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenuePlayerBan_venueId_playerId_key" ON "VenuePlayerBan"("venueId", "playerId");
CREATE INDEX "VenuePlayerBan_venueId_idx" ON "VenuePlayerBan"("venueId");

ALTER TABLE "VenuePlayerBan" ADD CONSTRAINT "VenuePlayerBan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenuePlayerBan" ADD CONSTRAINT "VenuePlayerBan_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenuePlayerBan" ADD CONSTRAINT "VenuePlayerBan_createdByStaffPlayerId_fkey" FOREIGN KEY ("createdByStaffPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
