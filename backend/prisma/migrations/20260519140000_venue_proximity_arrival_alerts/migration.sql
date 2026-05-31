-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "proximityAlertRadiusMeters" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Venue" ADD COLUMN "proximityAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProximityArrivalPushLog" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProximityArrivalPushLog_pkey" PRIMARY KEY ("playerId","venueId","dayKey")
);

-- CreateIndex
CREATE INDEX "ProximityArrivalPushLog_playerId_dayKey_idx" ON "ProximityArrivalPushLog"("playerId", "dayKey");

-- AddForeignKey
ALTER TABLE "ProximityArrivalPushLog" ADD CONSTRAINT "ProximityArrivalPushLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProximityArrivalPushLog" ADD CONSTRAINT "ProximityArrivalPushLog_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
