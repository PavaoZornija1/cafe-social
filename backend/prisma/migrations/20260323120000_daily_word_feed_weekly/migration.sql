-- CreateEnum
CREATE TYPE "VenueFeedEventKind" AS ENUM ('WORD_MATCH_STARTED', 'DAILY_WORD_SOLVED');

-- CreateTable
CREATE TABLE "PlayerDailyWord" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDailyWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDailyWord_playerId_dayKey_scopeKey_key" ON "PlayerDailyWord"("playerId", "dayKey", "scopeKey");

-- CreateIndex
CREATE INDEX "PlayerDailyWord_scopeKey_dayKey_idx" ON "PlayerDailyWord"("scopeKey", "dayKey");

-- AddForeignKey
ALTER TABLE "PlayerDailyWord" ADD CONSTRAINT "PlayerDailyWord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlayerDailyStreak" (
    "playerId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSolvedDayKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDailyStreak_pkey" PRIMARY KEY ("playerId","scopeKey")
);

-- AddForeignKey
ALTER TABLE "PlayerDailyStreak" ADD CONSTRAINT "PlayerDailyStreak_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "VenueFeedEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" "VenueFeedEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "actorUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueFeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueFeedEvent_venueId_createdAt_idx" ON "VenueFeedEvent"("venueId", "createdAt");

-- AddForeignKey
ALTER TABLE "VenueFeedEvent" ADD CONSTRAINT "VenueFeedEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "resetsWeekly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChallengeProgress" ADD COLUMN "periodKey" TEXT;
