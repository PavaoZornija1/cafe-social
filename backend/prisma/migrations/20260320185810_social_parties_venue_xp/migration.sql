-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "InviteLinkKind" AS ENUM ('PARTY', 'FRIEND');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastPresenceAt" TIMESTAMP(3),
ADD COLUMN     "lastPresenceVenueId" TEXT,
ADD COLUMN     "totalPrivacy" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "PlayerVenueStats" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "venueXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerVenueStats_pkey" PRIMARY KEY ("playerId","venueId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "playerLowId" TEXT NOT NULL,
    "playerHighId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "creatorId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "partyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("partyId","playerId")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "kind" "InviteLinkKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "partyId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerVenueStats_venueId_idx" ON "PlayerVenueStats"("venueId");

-- CreateIndex
CREATE INDEX "Friendship_playerLowId_idx" ON "Friendship"("playerLowId");

-- CreateIndex
CREATE INDEX "Friendship_playerHighId_idx" ON "Friendship"("playerHighId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_playerLowId_playerHighId_key" ON "Friendship"("playerLowId", "playerHighId");

-- CreateIndex
CREATE INDEX "Party_leaderId_idx" ON "Party"("leaderId");

-- CreateIndex
CREATE INDEX "Party_creatorId_idx" ON "Party"("creatorId");

-- CreateIndex
CREATE INDEX "PartyMember_playerId_idx" ON "PartyMember"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_tokenHash_key" ON "InviteLink"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteLink_createdById_idx" ON "InviteLink"("createdById");

-- CreateIndex
CREATE INDEX "InviteLink_partyId_idx" ON "InviteLink"("partyId");

-- AddForeignKey
ALTER TABLE "PlayerVenueStats" ADD CONSTRAINT "PlayerVenueStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVenueStats" ADD CONSTRAINT "PlayerVenueStats_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_playerLowId_fkey" FOREIGN KEY ("playerLowId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_playerHighId_fkey" FOREIGN KEY ("playerHighId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
