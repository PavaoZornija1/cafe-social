-- Platform daily/weekly quest claim ledger (progress is computed on read).
CREATE TABLE "PlayerPlatformQuestClaim" (
    "playerId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerPlatformQuestClaim_pkey" PRIMARY KEY ("playerId","questKey","periodKey")
);

CREATE INDEX "PlayerPlatformQuestClaim_playerId_periodKey_idx" ON "PlayerPlatformQuestClaim"("playerId", "periodKey");

ALTER TABLE "PlayerPlatformQuestClaim" ADD CONSTRAINT "PlayerPlatformQuestClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
