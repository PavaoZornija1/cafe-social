-- CreateEnum
CREATE TYPE "VenueOrganizationKind" AS ENUM ('SINGLE_LOCATION', 'MULTI_LOCATION');

-- AlterTable
ALTER TABLE "VenueOrganization" ADD COLUMN     "locationKind" "VenueOrganizationKind" NOT NULL DEFAULT 'SINGLE_LOCATION',
ADD COLUMN     "selfServeCreatedByPlayerId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VenueOrganization_selfServeCreatedByPlayerId_idx" ON "VenueOrganization"("selfServeCreatedByPlayerId");

-- AddForeignKey
ALTER TABLE "VenueOrganization" ADD CONSTRAINT "VenueOrganization_selfServeCreatedByPlayerId_fkey" FOREIGN KEY ("selfServeCreatedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
