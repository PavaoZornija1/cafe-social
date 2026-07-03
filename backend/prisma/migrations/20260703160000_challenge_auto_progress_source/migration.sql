-- CreateEnum
CREATE TYPE "ChallengeAutoProgressSource" AS ENUM ('WORD_MATCH', 'BRAWLER', 'DAILY_WORD', 'PRESENCE', 'MANUAL');

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "autoProgressSource" "ChallengeAutoProgressSource" NOT NULL DEFAULT 'WORD_MATCH';

-- Pilot challenge sources (ids from seed-pilot-venues.ts)
UPDATE "Challenge" SET "autoProgressSource" = 'DAILY_WORD' WHERE id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
UPDATE "Challenge" SET "autoProgressSource" = 'BRAWLER' WHERE id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
