-- CreateEnum
CREATE TYPE "PartyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "PartyPlayerInvite" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "invitedPlayerId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "PartyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPlayerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyPlayerInvite_partyId_invitedPlayerId_key" ON "PartyPlayerInvite"("partyId", "invitedPlayerId");

-- CreateIndex
CREATE INDEX "PartyPlayerInvite_invitedPlayerId_status_idx" ON "PartyPlayerInvite"("invitedPlayerId", "status");

-- CreateIndex
CREATE INDEX "PartyPlayerInvite_partyId_idx" ON "PartyPlayerInvite"("partyId");

-- AddForeignKey
ALTER TABLE "PartyPlayerInvite" ADD CONSTRAINT "PartyPlayerInvite_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPlayerInvite" ADD CONSTRAINT "PartyPlayerInvite_invitedPlayerId_fkey" FOREIGN KEY ("invitedPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPlayerInvite" ADD CONSTRAINT "PartyPlayerInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
