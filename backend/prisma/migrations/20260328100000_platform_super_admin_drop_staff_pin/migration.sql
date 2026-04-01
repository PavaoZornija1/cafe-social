-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Venue" DROP COLUMN IF EXISTS "staffPortalPinHash";
