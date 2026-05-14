-- Cumulative competitive rank (all ranked game modes). Independent of XP / tier.
ALTER TABLE "Player" ADD COLUMN "competitiveRankRating" INTEGER NOT NULL DEFAULT 1500;

-- Idempotency: competitive rank delta applied once per finished session (word, brawler, future).
ALTER TABLE "GameSession" ADD COLUMN "rankAwardedAt" TIMESTAMP(3);
