-- Perk expiry push idempotency
CREATE TABLE "PerkExpiryReminderLog" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerkExpiryReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerkExpiryReminderLog_redemptionId_kind_key" ON "PerkExpiryReminderLog"("redemptionId", "kind");

ALTER TABLE "PerkExpiryReminderLog" ADD CONSTRAINT "PerkExpiryReminderLog_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "VenuePerkRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Venue ban appeals (player-initiated)
CREATE TABLE "VenueBanAppeal" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueBanAppeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueBanAppeal_venueId_status_createdAt_idx" ON "VenueBanAppeal"("venueId", "status", "createdAt");
CREATE INDEX "VenueBanAppeal_playerId_createdAt_idx" ON "VenueBanAppeal"("playerId", "createdAt");

ALTER TABLE "VenueBanAppeal" ADD CONSTRAINT "VenueBanAppeal_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueBanAppeal" ADD CONSTRAINT "VenueBanAppeal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
