-- CMS-configurable links from reward keys (tiers, quest bundles) to venue perks.
CREATE TABLE "PlatformAutomatedReward" (
    "id" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "perkId" TEXT NOT NULL,
    "label" TEXT,
    "minLifetimeXp" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAutomatedReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAutomatedReward_rewardKey_key" ON "PlatformAutomatedReward"("rewardKey");
CREATE INDEX "PlatformAutomatedReward_perkId_idx" ON "PlatformAutomatedReward"("perkId");

ALTER TABLE "PlatformAutomatedReward" ADD CONSTRAINT "PlatformAutomatedReward_perkId_fkey" FOREIGN KEY ("perkId") REFERENCES "VenuePerk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
