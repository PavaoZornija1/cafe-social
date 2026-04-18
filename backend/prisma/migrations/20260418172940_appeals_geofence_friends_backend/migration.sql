-- AlterTable
ALTER TABLE "VenueBanAppeal" ADD COLUMN     "playerNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByStaffPlayerId" TEXT,
ADD COLUMN     "staffMessageToPlayer" TEXT,
ADD COLUMN     "staffNote" TEXT;

-- CreateTable
CREATE TABLE "PlayerVenueGeofenceEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientDedupeKey" TEXT,

    CONSTRAINT "PlayerVenueGeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerVenueGeofenceEvent_venueId_recordedAt_idx" ON "PlayerVenueGeofenceEvent"("venueId", "recordedAt");

-- CreateIndex
CREATE INDEX "PlayerVenueGeofenceEvent_playerId_venueId_recordedAt_idx" ON "PlayerVenueGeofenceEvent"("playerId", "venueId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerVenueGeofenceEvent_playerId_clientDedupeKey_key" ON "PlayerVenueGeofenceEvent"("playerId", "clientDedupeKey");

-- AddForeignKey
ALTER TABLE "VenueBanAppeal" ADD CONSTRAINT "VenueBanAppeal_resolvedByStaffPlayerId_fkey" FOREIGN KEY ("resolvedByStaffPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueGeofenceEvent" ADD CONSTRAINT "PlayerVenueGeofenceEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueGeofenceEvent" ADD CONSTRAINT "PlayerVenueGeofenceEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
