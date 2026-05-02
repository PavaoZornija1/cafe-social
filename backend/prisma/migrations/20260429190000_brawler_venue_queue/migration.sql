CREATE TYPE "BrawlerMatchQueueStatus" AS ENUM ('WAITING', 'MATCHED', 'CANCELLED');

CREATE TABLE "BrawlerMatchQueueEntry" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "ranked" BOOLEAN NOT NULL DEFAULT false,
    "brawlerHeroId" TEXT,
    "status" "BrawlerMatchQueueStatus" NOT NULL DEFAULT 'WAITING',
    "matchedSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrawlerMatchQueueEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrawlerMatchQueueEntry_bucket_idx" ON "BrawlerMatchQueueEntry" ("venueId", "ranked", "status", "createdAt");
CREATE INDEX "BrawlerMatchQueueEntry_player_status_idx" ON "BrawlerMatchQueueEntry" ("playerId", "status");

ALTER TABLE "BrawlerMatchQueueEntry" ADD CONSTRAINT "BrawlerMatchQueueEntry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrawlerMatchQueueEntry" ADD CONSTRAINT "BrawlerMatchQueueEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
