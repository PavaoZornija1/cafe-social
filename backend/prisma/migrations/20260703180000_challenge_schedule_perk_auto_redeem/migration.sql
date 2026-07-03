-- CreateEnum
CREATE TYPE "ChallengeScheduleType" AS ENUM ('ALWAYS', 'FIXED_RANGE', 'DAILY_RECURRING');

-- AlterTable
ALTER TABLE "VenuePerk" ADD COLUMN "autoRedeem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "scheduleType" "ChallengeScheduleType" NOT NULL DEFAULT 'ALWAYS';
ALTER TABLE "Challenge" ADD COLUMN "dailyStartMinutes" INTEGER;
ALTER TABLE "Challenge" ADD COLUMN "dailyEndMinutes" INTEGER;
ALTER TABLE "Challenge" ADD COLUMN "requiresWin" BOOLEAN NOT NULL DEFAULT false;
