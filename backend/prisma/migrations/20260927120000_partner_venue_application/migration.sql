-- CreateEnum
CREATE TYPE "PartnerVenueApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PartnerVenueApplication" (
    "id" TEXT NOT NULL,
    "status" "PartnerVenueApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "applicantEmail" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "submittedByPlayerId" TEXT,
    "venueName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofencePolygon" JSONB,
    "locationKind" "VenueOrganizationKind",
    "organizationName" TEXT,
    "analyticsTimeZone" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByPlayerId" TEXT,
    "rejectionReason" TEXT,
    "createdOrganizationId" TEXT,
    "createdVenueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerVenueApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerVenueApplication_status_createdAt_idx" ON "PartnerVenueApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerVenueApplication_applicantEmail_idx" ON "PartnerVenueApplication"("applicantEmail");

-- Partial unique: one pending application per email
CREATE UNIQUE INDEX "PartnerVenueApplication_applicantEmail_pending_key" ON "PartnerVenueApplication"("applicantEmail") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "PartnerVenueApplication" ADD CONSTRAINT "PartnerVenueApplication_submittedByPlayerId_fkey" FOREIGN KEY ("submittedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerVenueApplication" ADD CONSTRAINT "PartnerVenueApplication_reviewedByPlayerId_fkey" FOREIGN KEY ("reviewedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
