-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN "inviteCode" TEXT;

-- AlterTable
ALTER TABLE "WordSession" ADD COLUMN "sharedWordIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_inviteCode_key" ON "GameSession"("inviteCode");
