-- Upgrade from earlier draft names (word-only) to global competitive rank columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Player' AND column_name = 'wordVersusRankRating'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Player' AND column_name = 'competitiveRankRating'
  ) THEN
    ALTER TABLE "Player" RENAME COLUMN "wordVersusRankRating" TO "competitiveRankRating";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'GameSession' AND column_name = 'wordRankAwardedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'GameSession' AND column_name = 'rankAwardedAt'
  ) THEN
    ALTER TABLE "GameSession" RENAME COLUMN "wordRankAwardedAt" TO "rankAwardedAt";
  END IF;
END $$;
