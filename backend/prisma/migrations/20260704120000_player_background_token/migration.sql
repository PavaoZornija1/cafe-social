-- Long-lived auth for OS geofence enter/exit while the app is killed.
ALTER TABLE "Player" ADD COLUMN "backgroundTokenHash" TEXT;
ALTER TABLE "Player" ADD COLUMN "backgroundTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Player_backgroundTokenHash_key" ON "Player"("backgroundTokenHash");
