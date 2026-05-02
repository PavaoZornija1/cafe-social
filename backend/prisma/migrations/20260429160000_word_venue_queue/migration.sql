CREATE TYPE "WordMatchQueueStatus" AS ENUM ('WAITING', 'MATCHED', 'CANCELLED');
CREATE TYPE "WordMatchQueueMode" AS ENUM ('COOP', 'VERSUS');

CREATE TABLE "WordMatchQueueEntry" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "mode" "WordMatchQueueMode" NOT NULL,
    "difficulty" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "category" "WordCategory",
    "ranked" BOOLEAN NOT NULL DEFAULT false,
    "status" "WordMatchQueueStatus" NOT NULL DEFAULT 'WAITING',
    "matchedSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordMatchQueueEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WordMatchQueueEntry_bucket_idx" ON "WordMatchQueueEntry" ("venueId", "mode", "difficulty", "wordCount", "language", "category", "ranked", "status", "createdAt");
CREATE INDEX "WordMatchQueueEntry_player_status_idx" ON "WordMatchQueueEntry" ("playerId", "status");

ALTER TABLE "WordMatchQueueEntry" ADD CONSTRAINT "WordMatchQueueEntry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordMatchQueueEntry" ADD CONSTRAINT "WordMatchQueueEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
