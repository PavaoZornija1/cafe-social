-- CreateTable
CREATE TABLE "VenueType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueVenueType" (
    "venueId" TEXT NOT NULL,
    "venueTypeId" TEXT NOT NULL,

    CONSTRAINT "VenueVenueType_pkey" PRIMARY KEY ("venueId","venueTypeId")
);

-- CreateTable
CREATE TABLE "VenueOrderNudgeTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nudgeType" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "sortPriority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueOrderNudgeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueOrderNudgeTemplateVenueType" (
    "templateId" TEXT NOT NULL,
    "venueTypeId" TEXT NOT NULL,

    CONSTRAINT "VenueOrderNudgeTemplateVenueType_pkey" PRIMARY KEY ("templateId","venueTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueType_code_key" ON "VenueType"("code");

-- CreateIndex
CREATE INDEX "VenueVenueType_venueTypeId_idx" ON "VenueVenueType"("venueTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueOrderNudgeTemplate_code_key" ON "VenueOrderNudgeTemplate"("code");

-- CreateIndex
CREATE INDEX "VenueOrderNudgeTemplate_active_sortPriority_idx" ON "VenueOrderNudgeTemplate"("active", "sortPriority");

-- CreateIndex
CREATE INDEX "VenueOrderNudgeTemplateVenueType_venueTypeId_idx" ON "VenueOrderNudgeTemplateVenueType"("venueTypeId");

-- AddForeignKey
ALTER TABLE "VenueVenueType" ADD CONSTRAINT "VenueVenueType_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueVenueType" ADD CONSTRAINT "VenueVenueType_venueTypeId_fkey" FOREIGN KEY ("venueTypeId") REFERENCES "VenueType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOrderNudgeTemplateVenueType" ADD CONSTRAINT "VenueOrderNudgeTemplateVenueType_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VenueOrderNudgeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOrderNudgeTemplateVenueType" ADD CONSTRAINT "VenueOrderNudgeTemplateVenueType_venueTypeId_fkey" FOREIGN KEY ("venueTypeId") REFERENCES "VenueType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
