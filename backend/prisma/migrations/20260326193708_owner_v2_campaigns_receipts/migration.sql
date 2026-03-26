-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReceiptSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "analyticsTimeZone" TEXT;

-- AlterTable
ALTER TABLE "VenuePerkRedemption" ADD COLUMN     "staffAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "staffAcknowledgedByPlayerId" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByPlayerId" TEXT;

-- CreateTable
CREATE TABLE "VenueCampaign" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segmentDays" INTEGER NOT NULL DEFAULT 30,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER,
    "pushSentCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueCampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "VenueCampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueReceiptSubmission" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "notePlayer" TEXT,
    "status" "ReceiptSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "staffNote" TEXT,
    "abuseFlag" BOOLEAN NOT NULL DEFAULT false,
    "retentionUntil" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueReceiptSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueCampaign_venueId_idx" ON "VenueCampaign"("venueId");

-- CreateIndex
CREATE INDEX "VenueCampaignSend_campaignId_idx" ON "VenueCampaignSend"("campaignId");

-- CreateIndex
CREATE INDEX "VenueCampaignSend_playerId_idx" ON "VenueCampaignSend"("playerId");

-- CreateIndex
CREATE INDEX "VenueReceiptSubmission_venueId_status_idx" ON "VenueReceiptSubmission"("venueId", "status");

-- CreateIndex
CREATE INDEX "VenueReceiptSubmission_playerId_idx" ON "VenueReceiptSubmission"("playerId");

-- CreateIndex
CREATE INDEX "VenuePerkRedemption_voidedAt_idx" ON "VenuePerkRedemption"("voidedAt");

-- AddForeignKey
ALTER TABLE "VenueCampaign" ADD CONSTRAINT "VenueCampaign_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueCampaignSend" ADD CONSTRAINT "VenueCampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "VenueCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueCampaignSend" ADD CONSTRAINT "VenueCampaignSend_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReceiptSubmission" ADD CONSTRAINT "VenueReceiptSubmission_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReceiptSubmission" ADD CONSTRAINT "VenueReceiptSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReceiptSubmission" ADD CONSTRAINT "VenueReceiptSubmission_reviewedByPlayerId_fkey" FOREIGN KEY ("reviewedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_staffAcknowledgedByPlayerId_fkey" FOREIGN KEY ("staffAcknowledgedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePerkRedemption" ADD CONSTRAINT "VenuePerkRedemption_voidedByPlayerId_fkey" FOREIGN KEY ("voidedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
