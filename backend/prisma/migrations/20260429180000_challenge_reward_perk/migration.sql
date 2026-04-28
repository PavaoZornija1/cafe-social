-- Optional perk granted when a player completes the challenge (see ChallengeService).
ALTER TABLE "Challenge" ADD COLUMN "rewardPerkId" TEXT;

CREATE INDEX "Challenge_rewardPerkId_idx" ON "Challenge"("rewardPerkId");

ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_rewardPerkId_fkey" FOREIGN KEY ("rewardPerkId") REFERENCES "VenuePerk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
