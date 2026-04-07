-- CreateTable
CREATE TABLE "PlayerVenuePlayDay" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "playSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerVenuePlayDay_pkey" PRIMARY KEY ("playerId","venueId","dayKey")
);

-- CreateTable
CREATE TABLE "PlayerVenuePlaySession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gameSessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerVenuePlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerVenuePlayDay_venueId_dayKey_idx" ON "PlayerVenuePlayDay"("venueId", "dayKey");

-- CreateIndex
CREATE INDEX "PlayerVenuePlayDay_playerId_dayKey_idx" ON "PlayerVenuePlayDay"("playerId", "dayKey");

-- CreateIndex
CREATE INDEX "PlayerVenuePlaySession_playerId_endedAt_idx" ON "PlayerVenuePlaySession"("playerId", "endedAt");

-- CreateIndex
CREATE INDEX "PlayerVenuePlaySession_playerId_venueId_kind_idx" ON "PlayerVenuePlaySession"("playerId", "venueId", "kind");

-- CreateIndex
CREATE INDEX "PlayerVenuePlaySession_playerId_gameSessionId_kind_idx" ON "PlayerVenuePlaySession"("playerId", "gameSessionId", "kind");

-- AddForeignKey
ALTER TABLE "PlayerVenuePlayDay" ADD CONSTRAINT "PlayerVenuePlayDay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenuePlayDay" ADD CONSTRAINT "PlayerVenuePlayDay_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenuePlaySession" ADD CONSTRAINT "PlayerVenuePlaySession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenuePlaySession" ADD CONSTRAINT "PlayerVenuePlaySession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
