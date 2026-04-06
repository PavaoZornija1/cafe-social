-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "lastAdminNudgeBroadcastAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VenueOrderNudgeTemplate" ADD COLUMN "description" TEXT,
ADD COLUMN "defaultAfterMinutes" INTEGER;

-- CreateTable
CREATE TABLE "VenueNudgeAssignment" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "titleOverride" TEXT,
    "bodyOverride" TEXT,
    "afterMinutesOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueNudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueNudgeAssignment_venueId_templateId_key" ON "VenueNudgeAssignment"("venueId", "templateId");

-- CreateIndex
CREATE INDEX "VenueNudgeAssignment_venueId_idx" ON "VenueNudgeAssignment"("venueId");

-- CreateIndex
CREATE INDEX "VenueNudgeAssignment_templateId_idx" ON "VenueNudgeAssignment"("templateId");

-- AddForeignKey
ALTER TABLE "VenueNudgeAssignment" ADD CONSTRAINT "VenueNudgeAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueNudgeAssignment" ADD CONSTRAINT "VenueNudgeAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VenueOrderNudgeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
