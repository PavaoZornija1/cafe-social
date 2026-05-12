-- CreateTable
CREATE TABLE "PlayerVenueActivePlayBudgetDay" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "consumedActiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "iapBonusSecondsRemaining" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerVenueActivePlayBudgetDay_pkey" PRIMARY KEY ("playerId","venueId","dayKey")
);

-- CreateTable
CREATE TABLE "PlayerVenueActivePlaySession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gameSessionId" TEXT,
    "soloWordSessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerVenueActivePlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenuePlayBudgetIapGrant" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeTransactionId" TEXT NOT NULL,
    "grantedSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenuePlayBudgetIapGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerVenueActivePlayBudgetDay_venueId_dayKey_idx" ON "PlayerVenueActivePlayBudgetDay"("venueId", "dayKey");

-- CreateIndex
CREATE INDEX "PlayerVenueActivePlayBudgetDay_playerId_dayKey_idx" ON "PlayerVenueActivePlayBudgetDay"("playerId", "dayKey");

-- CreateIndex
CREATE INDEX "PlayerVenueActivePlaySession_playerId_endedAt_idx" ON "PlayerVenueActivePlaySession"("playerId", "endedAt");

-- CreateIndex
CREATE INDEX "PlayerVenueActivePlaySession_playerId_lastTickAt_idx" ON "PlayerVenueActivePlaySession"("playerId", "lastTickAt");

-- CreateIndex
CREATE UNIQUE INDEX "VenuePlayBudgetIapGrant_storeTransactionId_key" ON "VenuePlayBudgetIapGrant"("storeTransactionId");

-- CreateIndex
CREATE INDEX "VenuePlayBudgetIapGrant_playerId_createdAt_idx" ON "VenuePlayBudgetIapGrant"("playerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayerVenueActivePlayBudgetDay" ADD CONSTRAINT "PlayerVenueActivePlayBudgetDay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueActivePlayBudgetDay" ADD CONSTRAINT "PlayerVenueActivePlayBudgetDay_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueActivePlaySession" ADD CONSTRAINT "PlayerVenueActivePlaySession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueActivePlaySession" ADD CONSTRAINT "PlayerVenueActivePlaySession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePlayBudgetIapGrant" ADD CONSTRAINT "VenuePlayBudgetIapGrant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePlayBudgetIapGrant" ADD CONSTRAINT "VenuePlayBudgetIapGrant_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
