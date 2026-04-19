-- Tier progression uses total XP = sum(venue XP) + bonusXp (global wins).
ALTER TABLE "Player" ADD COLUMN "bonusXp" INTEGER NOT NULL DEFAULT 0;

-- Idempotent win XP for finished multiplayer / brawler sessions.
ALTER TABLE "GameSession" ADD COLUMN "winXpAwardedAt" TIMESTAMP(3);

-- Solo deck complete & daily first-solve XP idempotency.
ALTER TABLE "SoloWordSession" ADD COLUMN "winXpAwarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerDailyWord" ADD COLUMN "winXpAwarded" BOOLEAN NOT NULL DEFAULT false;
