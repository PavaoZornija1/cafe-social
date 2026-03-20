-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('WORD_GAME', 'BRAWLER');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'PENDING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GameParticipantResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "GameEventType" AS ENUM ('SESSION_STARTED', 'SESSION_ENDED', 'PHASE_CHANGED', 'ELIMINATION', 'SCORE_CHANGED', 'POWERUP_PICKED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BrawlerPhase" AS ENUM ('CHAOS', 'ENDGAME', 'SUDDEN_DEATH');

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'PENDING',
    "venueId" TEXT,
    "partyId" TEXT,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "botName" TEXT,
    "displayNameSnapshot" TEXT,
    "characterSnapshot" TEXT,
    "brawlerHeroId" TEXT,
    "heroSnapshot" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "placement" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "result" "GameParticipantResult",
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "eventType" "GameEventType" NOT NULL,
    "atMs" INTEGER NOT NULL,
    "actorParticipantId" TEXT,
    "targetParticipantId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStats" (
    "playerId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "dnfs" INTEGER NOT NULL DEFAULT 0,
    "totalKills" INTEGER NOT NULL DEFAULT 0,
    "totalDeaths" INTEGER NOT NULL DEFAULT 0,
    "totalAssists" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "bestPlacement" INTEGER,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstPlayedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGameStats_pkey" PRIMARY KEY ("playerId","gameType")
);

-- CreateTable
CREATE TABLE "PlayerGameVenueStats" (
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGameVenueStats_pkey" PRIMARY KEY ("playerId","venueId","gameType")
);

-- CreateTable
CREATE TABLE "BrawlerSession" (
    "sessionId" TEXT NOT NULL,
    "chaosDurationMs" INTEGER NOT NULL DEFAULT 45000,
    "endgameDurationMs" INTEGER NOT NULL DEFAULT 15000,
    "suddenDeathMaxMs" INTEGER NOT NULL DEFAULT 15000,
    "respawnDelayMs" INTEGER NOT NULL DEFAULT 3000,
    "lavaStartsAtMs" INTEGER NOT NULL DEFAULT 45000,
    "platformsCollapseAtMs" INTEGER NOT NULL DEFAULT 45000,
    "rngSeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrawlerSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "BrawlerHero" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archetype" TEXT,
    "avatarImageUrl" TEXT,
    "portraitImageUrl" TEXT,
    "spriteSheetUrl" TEXT,
    "spriteMeta" JSONB,
    "baseHp" INTEGER NOT NULL,
    "moveSpeed" DOUBLE PRECISION NOT NULL,
    "dashCooldownMs" INTEGER NOT NULL,
    "attackDamage" INTEGER NOT NULL,
    "attackKnockback" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrawlerHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrawlerParticipantStats" (
    "participantId" TEXT NOT NULL,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "damageTaken" INTEGER NOT NULL DEFAULT 0,
    "ringOuts" INTEGER NOT NULL DEFAULT 0,
    "falls" INTEGER NOT NULL DEFAULT 0,
    "respawns" INTEGER NOT NULL DEFAULT 0,
    "powerupsPicked" INTEGER NOT NULL DEFAULT 0,
    "powerupsUsed" INTEGER NOT NULL DEFAULT 0,
    "longestSurvivalMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrawlerParticipantStats_pkey" PRIMARY KEY ("participantId")
);

-- CreateTable
CREATE TABLE "WordSession" (
    "sessionId" TEXT NOT NULL,
    "roundCount" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "WordParticipantStats" (
    "participantId" TEXT NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "streakBest" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordParticipantStats_pkey" PRIMARY KEY ("participantId")
);

-- CreateIndex
CREATE INDEX "GameSession_gameType_status_createdAt_idx" ON "GameSession"("gameType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_startedAt_idx" ON "GameSession"("startedAt");

-- CreateIndex
CREATE INDEX "GameSession_endedAt_idx" ON "GameSession"("endedAt");

-- CreateIndex
CREATE INDEX "GameSession_venueId_gameType_createdAt_idx" ON "GameSession"("venueId", "gameType", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_partyId_createdAt_idx" ON "GameSession"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "GameParticipant_sessionId_idx" ON "GameParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "GameParticipant_playerId_createdAt_idx" ON "GameParticipant"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "GameParticipant_sessionId_placement_idx" ON "GameParticipant"("sessionId", "placement");

-- CreateIndex
CREATE INDEX "GameParticipant_sessionId_score_idx" ON "GameParticipant"("sessionId", "score");

-- CreateIndex
CREATE INDEX "GameParticipant_brawlerHeroId_idx" ON "GameParticipant"("brawlerHeroId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_player_per_session" ON "GameParticipant"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "GameEvent_sessionId_atMs_idx" ON "GameEvent"("sessionId", "atMs");

-- CreateIndex
CREATE INDEX "GameEvent_gameType_eventType_createdAt_idx" ON "GameEvent"("gameType", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_actorParticipantId_idx" ON "GameEvent"("actorParticipantId");

-- CreateIndex
CREATE INDEX "GameEvent_targetParticipantId_idx" ON "GameEvent"("targetParticipantId");

-- CreateIndex
CREATE INDEX "PlayerGameStats_gameType_wins_idx" ON "PlayerGameStats"("gameType", "wins");

-- CreateIndex
CREATE INDEX "PlayerGameStats_gameType_winRate_idx" ON "PlayerGameStats"("gameType", "winRate");

-- CreateIndex
CREATE INDEX "PlayerGameStats_gameType_lastPlayedAt_idx" ON "PlayerGameStats"("gameType", "lastPlayedAt");

-- CreateIndex
CREATE INDEX "PlayerGameVenueStats_venueId_gameType_wins_idx" ON "PlayerGameVenueStats"("venueId", "gameType", "wins");

-- CreateIndex
CREATE INDEX "PlayerGameVenueStats_venueId_gameType_totalScore_idx" ON "PlayerGameVenueStats"("venueId", "gameType", "totalScore");

-- CreateIndex
CREATE INDEX "BrawlerHero_isActive_idx" ON "BrawlerHero"("isActive");

-- CreateIndex
CREATE INDEX "BrawlerHero_name_idx" ON "BrawlerHero"("name");

-- CreateIndex
CREATE INDEX "BrawlerParticipantStats_damageDealt_idx" ON "BrawlerParticipantStats"("damageDealt");

-- CreateIndex
CREATE INDEX "BrawlerParticipantStats_ringOuts_idx" ON "BrawlerParticipantStats"("ringOuts");

-- CreateIndex
CREATE INDEX "WordParticipantStats_correctAnswers_idx" ON "WordParticipantStats"("correctAnswers");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_brawlerHeroId_fkey" FOREIGN KEY ("brawlerHeroId") REFERENCES "BrawlerHero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_actorParticipantId_fkey" FOREIGN KEY ("actorParticipantId") REFERENCES "GameParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "GameParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStats" ADD CONSTRAINT "PlayerGameStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameVenueStats" ADD CONSTRAINT "PlayerGameVenueStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameVenueStats" ADD CONSTRAINT "PlayerGameVenueStats_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrawlerSession" ADD CONSTRAINT "BrawlerSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrawlerParticipantStats" ADD CONSTRAINT "BrawlerParticipantStats_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordSession" ADD CONSTRAINT "WordSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordParticipantStats" ADD CONSTRAINT "WordParticipantStats_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
