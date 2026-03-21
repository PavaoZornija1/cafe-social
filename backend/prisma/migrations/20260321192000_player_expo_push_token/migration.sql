-- CreateTable
CREATE TABLE "PlayerExpoPushToken" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerExpoPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerExpoPushToken_token_key" ON "PlayerExpoPushToken"("token");

-- CreateIndex
CREATE INDEX "PlayerExpoPushToken_playerId_idx" ON "PlayerExpoPushToken"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerExpoPushToken" ADD CONSTRAINT "PlayerExpoPushToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
