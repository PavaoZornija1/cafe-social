-- CreateTable
CREATE TABLE "VenueOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "platformBillingPlan" TEXT,
    "platformBillingStatus" TEXT NOT NULL DEFAULT 'NONE',
    "platformBillingRenewsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "billingPortalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueOrganization_slug_key" ON "VenueOrganization"("slug");

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockReason" TEXT;

-- CreateIndex
CREATE INDEX "Venue_organizationId_idx" ON "Venue"("organizationId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "VenueStaffInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "VenueStaffInvite" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "VenueStaffRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "VenueStaffInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueStaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueStaffInvite_token_key" ON "VenueStaffInvite"("token");

-- CreateIndex
CREATE INDEX "VenueStaffInvite_venueId_idx" ON "VenueStaffInvite"("venueId");

-- CreateIndex
CREATE INDEX "VenueStaffInvite_email_idx" ON "VenueStaffInvite"("email");

-- AddForeignKey
ALTER TABLE "VenueStaffInvite" ADD CONSTRAINT "VenueStaffInvite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaffInvite" ADD CONSTRAINT "VenueStaffInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
