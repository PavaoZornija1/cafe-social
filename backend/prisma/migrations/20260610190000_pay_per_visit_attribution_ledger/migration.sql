-- ProximityArrivalPushLog: allow multiple nudges per player/venue/day (UUID PK).
ALTER TABLE "ProximityArrivalPushLog" ADD COLUMN "id" TEXT;
UPDATE "ProximityArrivalPushLog" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "ProximityArrivalPushLog" ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "ProximityArrivalPushLog" DROP CONSTRAINT "ProximityArrivalPushLog_pkey";
ALTER TABLE "ProximityArrivalPushLog" ADD CONSTRAINT "ProximityArrivalPushLog_pkey" PRIMARY KEY ("id");

ALTER TABLE "ProximityArrivalPushLog" ADD COLUMN "featuredOfferId" TEXT;
ALTER TABLE "ProximityArrivalPushLog" ADD COLUMN "proximityRadiusMeters" INTEGER;

CREATE INDEX "ProximityArrivalPushLog_playerId_venueId_dayKey_idx" ON "ProximityArrivalPushLog"("playerId", "venueId", "dayKey");
CREATE INDEX "ProximityArrivalPushLog_playerId_venueId_sentAt_idx" ON "ProximityArrivalPushLog"("playerId", "venueId", "sentAt");

-- Ring geofence events: label boundary type for area foot-traffic analytics.
ALTER TABLE "PlayerVenueGeofenceEvent" ADD COLUMN "boundaryType" TEXT NOT NULL DEFAULT 'proximity_ring';
CREATE INDEX "PlayerVenueGeofenceEvent_venueId_boundaryType_recordedAt_idx" ON "PlayerVenueGeofenceEvent"("venueId", "boundaryType", "recordedAt");

-- Play-polygon sessions for dwell, attribution, and future PPV billing.
CREATE TABLE "PlayerVenuePolygonSession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "dwellSeconds" INTEGER,
    "nudgeLogId" TEXT,
    "attributionMet" BOOLEAN NOT NULL DEFAULT false,
    "dwellQualified" BOOLEAN NOT NULL DEFAULT false,
    "billableAt" TIMESTAMP(3),

    CONSTRAINT "PlayerVenuePolygonSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerVenuePolygonSession_nudgeLogId_key" ON "PlayerVenuePolygonSession"("nudgeLogId");
CREATE INDEX "PlayerVenuePolygonSession_venueId_enteredAt_idx" ON "PlayerVenuePolygonSession"("venueId", "enteredAt");
CREATE INDEX "PlayerVenuePolygonSession_playerId_venueId_dayKey_idx" ON "PlayerVenuePolygonSession"("playerId", "venueId", "dayKey");
CREATE INDEX "PlayerVenuePolygonSession_playerId_enteredAt_idx" ON "PlayerVenuePolygonSession"("playerId", "enteredAt");
CREATE INDEX "PlayerVenuePolygonSession_venueId_billableAt_idx" ON "PlayerVenuePolygonSession"("venueId", "billableAt");

ALTER TABLE "PlayerVenuePolygonSession" ADD CONSTRAINT "PlayerVenuePolygonSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerVenuePolygonSession" ADD CONSTRAINT "PlayerVenuePolygonSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerVenuePolygonSession" ADD CONSTRAINT "PlayerVenuePolygonSession_nudgeLogId_fkey" FOREIGN KEY ("nudgeLogId") REFERENCES "ProximityArrivalPushLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
