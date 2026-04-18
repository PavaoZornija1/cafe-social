-- Player blocks (either direction hides social surfaces + blocks new friend requests).
CREATE TABLE "PlayerBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

CREATE INDEX "PlayerBlock_blockedId_idx" ON "PlayerBlock"("blockedId");

ALTER TABLE "PlayerBlock" ADD CONSTRAINT "PlayerBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerBlock" ADD CONSTRAINT "PlayerBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Staff-visible audit trail for moderation actions.
CREATE TABLE "VenueModerationAuditLog" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "actorPlayerId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueModerationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueModerationAuditLog_venueId_createdAt_idx" ON "VenueModerationAuditLog"("venueId", "createdAt");

ALTER TABLE "VenueModerationAuditLog" ADD CONSTRAINT "VenueModerationAuditLog_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueModerationAuditLog" ADD CONSTRAINT "VenueModerationAuditLog_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional short message shown to the reporter when a report is dismissed.
ALTER TABLE "VenuePlayerReport" ADD COLUMN "dismissalNoteToReporter" TEXT;
