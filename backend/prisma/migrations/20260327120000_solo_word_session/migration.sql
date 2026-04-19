-- CreateTable
CREATE TABLE "SoloWordSession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "wordIds" TEXT[],
    "wordIndex" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL,
    "category" "WordCategory",
    "difficulty" TEXT NOT NULL DEFAULT 'normal',
    "venueId" TEXT,
    "globalPlay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SoloWordSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloWordSession_playerId_idx" ON "SoloWordSession"("playerId");

-- CreateIndex
CREATE INDEX "SoloWordSession_expiresAt_idx" ON "SoloWordSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "SoloWordSession" ADD CONSTRAINT "SoloWordSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
