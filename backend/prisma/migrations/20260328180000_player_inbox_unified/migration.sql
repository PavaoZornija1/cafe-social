-- Unified inbox + extensible kinds for future invite types.
CREATE TYPE "InboxKind" AS ENUM ('FRIEND_REQUEST', 'PARTY_INVITE', 'WORD_MATCH_INVITE', 'STAFF_INVITE', 'PERK_OR_OFFER');
CREATE TYPE "InboxStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "PlayerInboxItem" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "InboxKind" NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'PENDING',
    "externalRefId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "friendshipId" TEXT,
    "partyInviteId" TEXT,

    CONSTRAINT "PlayerInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerInboxItem_friendshipId_key" ON "PlayerInboxItem"("friendshipId");
CREATE UNIQUE INDEX "PlayerInboxItem_partyInviteId_key" ON "PlayerInboxItem"("partyInviteId");
CREATE INDEX "PlayerInboxItem_recipientId_status_idx" ON "PlayerInboxItem"("recipientId", "status");
CREATE INDEX "PlayerInboxItem_kind_status_idx" ON "PlayerInboxItem"("kind", "status");

ALTER TABLE "PlayerInboxItem" ADD CONSTRAINT "PlayerInboxItem_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerInboxItem" ADD CONSTRAINT "PlayerInboxItem_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerInboxItem" ADD CONSTRAINT "PlayerInboxItem_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "Friendship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerInboxItem" ADD CONSTRAINT "PlayerInboxItem_partyInviteId_fkey" FOREIGN KEY ("partyInviteId") REFERENCES "PartyPlayerInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing pending friend requests → inbox rows
INSERT INTO "PlayerInboxItem" ("id", "recipientId", "actorId", "kind", "status", "createdAt", "updatedAt", "friendshipId")
SELECT gen_random_uuid(),
  CASE WHEN f."requestedById" = f."playerLowId" THEN f."playerHighId" ELSE f."playerLowId" END,
  f."requestedById",
  'FRIEND_REQUEST',
  'PENDING',
  f."createdAt",
  f."updatedAt",
  f."id"
FROM "Friendship" f
WHERE f."status" = 'PENDING';

-- Existing pending party invites → inbox rows
INSERT INTO "PlayerInboxItem" ("id", "recipientId", "actorId", "kind", "status", "createdAt", "updatedAt", "partyInviteId")
SELECT gen_random_uuid(),
  pi."invitedPlayerId",
  pi."invitedById",
  'PARTY_INVITE',
  'PENDING',
  pi."createdAt",
  pi."updatedAt",
  pi."id"
FROM "PartyPlayerInvite" pi
WHERE pi."status" = 'PENDING';
