-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "requiresExplicitCheckIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlayerVenueCheckIn" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "lastCheckInAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerVenueCheckIn_pkey" PRIMARY KEY ("playerId","venueId")
);

-- CreateIndex
CREATE INDEX "PlayerVenueCheckIn_venueId_lastCheckInAt_idx" ON "PlayerVenueCheckIn"("venueId", "lastCheckInAt");

-- AddForeignKey
ALTER TABLE "PlayerVenueCheckIn" ADD CONSTRAINT "PlayerVenueCheckIn_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueCheckIn" ADD CONSTRAINT "PlayerVenueCheckIn_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
