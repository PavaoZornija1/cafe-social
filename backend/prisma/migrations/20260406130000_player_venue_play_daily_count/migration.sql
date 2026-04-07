-- Replace time-based venue guest play with a per-day **game count** cap.

DROP TABLE IF EXISTS "PlayerVenuePlaySession";

ALTER TABLE "PlayerVenuePlayDay" DROP COLUMN "playSeconds";
ALTER TABLE "PlayerVenuePlayDay" ADD COLUMN "gamesPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerVenuePlayDay" ADD COLUMN "lastSoloDeckAt" TIMESTAMP(3);

CREATE TABLE "PlayerVenuePlayCountedGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,

    CONSTRAINT "PlayerVenuePlayCountedGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerVenuePlayCountedGame_playerId_gameSessionId_kind_key" ON "PlayerVenuePlayCountedGame"("playerId", "gameSessionId", "kind");

CREATE INDEX "PlayerVenuePlayCountedGame_playerId_dayKey_idx" ON "PlayerVenuePlayCountedGame"("playerId", "dayKey");

ALTER TABLE "PlayerVenuePlayCountedGame" ADD CONSTRAINT "PlayerVenuePlayCountedGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerVenuePlayCountedGame" ADD CONSTRAINT "PlayerVenuePlayCountedGame_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
