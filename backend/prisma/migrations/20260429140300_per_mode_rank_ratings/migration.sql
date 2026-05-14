-- Per-game competitive ratings (global `competitiveRankRating` is updated alongside the relevant mode).
ALTER TABLE "Player" ADD COLUMN "wordRankRating" INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE "Player" ADD COLUMN "brawlerRankRating" INTEGER NOT NULL DEFAULT 1500;
