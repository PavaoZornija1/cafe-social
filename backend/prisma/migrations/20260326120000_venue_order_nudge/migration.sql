-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "orderNudgeTitle" TEXT,
ADD COLUMN "orderNudgeBody" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "venueNudgeSessionVenueId" TEXT,
ADD COLUMN "venueNudgeSessionStartedAt" TIMESTAMP(3),
ADD COLUMN "venueNudgeLastSentAt" TIMESTAMP(3);
