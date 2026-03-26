-- CreateEnum
CREATE TYPE "VenueStaffRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'OWNER');

-- CreateTable
CREATE TABLE "VenueStaff" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "VenueStaffRole" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueStaff_playerId_idx" ON "VenueStaff"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueStaff_venueId_playerId_key" ON "VenueStaff"("venueId", "playerId");

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
