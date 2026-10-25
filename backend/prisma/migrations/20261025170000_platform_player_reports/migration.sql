-- AlterTable
ALTER TABLE "VenueModerationAuditLog" ALTER COLUMN "venueId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VenuePlayerReport" ALTER COLUMN "venueId" DROP NOT NULL;
