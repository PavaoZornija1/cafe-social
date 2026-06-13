-- Tier display rungs (e.g. tier.base) may exist without a linked perk.
ALTER TABLE "PlatformAutomatedReward" DROP CONSTRAINT "PlatformAutomatedReward_perkId_fkey";
ALTER TABLE "PlatformAutomatedReward" ALTER COLUMN "perkId" DROP NOT NULL;
ALTER TABLE "PlatformAutomatedReward" ADD CONSTRAINT "PlatformAutomatedReward_perkId_fkey" FOREIGN KEY ("perkId") REFERENCES "VenuePerk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
