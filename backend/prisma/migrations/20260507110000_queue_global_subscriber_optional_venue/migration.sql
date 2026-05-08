-- Cross-venue matchmaking + subscriber bypass: allow null `venueId` on queue entries
-- so subscribers can queue from anywhere, and rebuild bucket indexes to be venue-agnostic.

-- Word match queue ----------------------------------------------------------
ALTER TABLE "WordMatchQueueEntry" DROP CONSTRAINT "WordMatchQueueEntry_venueId_fkey";
ALTER TABLE "WordMatchQueueEntry" ALTER COLUMN "venueId" DROP NOT NULL;
ALTER TABLE "WordMatchQueueEntry"
  ADD CONSTRAINT "WordMatchQueueEntry_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "WordMatchQueueEntry_bucket_idx";
CREATE INDEX "WordMatchQueueEntry_bucket_idx"
  ON "WordMatchQueueEntry" ("mode", "difficulty", "wordCount", "language", "category", "ranked", "status", "createdAt");
CREATE INDEX "WordMatchQueueEntry_venue_status_idx"
  ON "WordMatchQueueEntry" ("venueId", "status");

-- Brawler match queue -------------------------------------------------------
ALTER TABLE "BrawlerMatchQueueEntry" DROP CONSTRAINT "BrawlerMatchQueueEntry_venueId_fkey";
ALTER TABLE "BrawlerMatchQueueEntry" ALTER COLUMN "venueId" DROP NOT NULL;
ALTER TABLE "BrawlerMatchQueueEntry"
  ADD CONSTRAINT "BrawlerMatchQueueEntry_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "BrawlerMatchQueueEntry_bucket_idx";
CREATE INDEX "BrawlerMatchQueueEntry_bucket_idx"
  ON "BrawlerMatchQueueEntry" ("ranked", "status", "createdAt");
CREATE INDEX "BrawlerMatchQueueEntry_venue_status_idx"
  ON "BrawlerMatchQueueEntry" ("venueId", "status");
