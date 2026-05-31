-- CreateTable
CREATE TABLE "DailyStreakAtRiskPushLog" (
    "playerId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStreakAtRiskPushLog_pkey" PRIMARY KEY ("playerId","scopeKey","dayKey")
);

-- CreateIndex
CREATE INDEX "DailyStreakAtRiskPushLog_dayKey_idx" ON "DailyStreakAtRiskPushLog"("dayKey");

-- AddForeignKey
ALTER TABLE "DailyStreakAtRiskPushLog" ADD CONSTRAINT "DailyStreakAtRiskPushLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
