/*
  Warnings:

  - You are about to drop the `GameSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerReward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reward` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email,username]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WordCategory" AS ENUM ('DRINK_FOOD', 'PLACE_ATMOSPHERE', 'MUSIC_CULTURE', 'PEOPLE_ROLES', 'MOMENTS_ACTIONS');

-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_playerId_fkey";

-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_venueId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerReward" DROP CONSTRAINT "PlayerReward_playerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerReward" DROP CONSTRAINT "PlayerReward_rewardId_fkey";

-- DropTable
DROP TABLE "GameSession";

-- DropTable
DROP TABLE "PlayerReward";

-- DropTable
DROP TABLE "Reward";

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "WordCategory" NOT NULL,
    "sentenceHint" TEXT NOT NULL,
    "wordHints" TEXT[],
    "emojiHints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_text_language_key" ON "Word"("text", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_username_key" ON "Player"("email", "username");
