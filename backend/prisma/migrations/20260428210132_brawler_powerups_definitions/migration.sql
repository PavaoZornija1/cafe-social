-- CreateEnum
CREATE TYPE "BrawlerPowerupEffectType" AS ENUM ('MOVE_SPEED_MULT', 'ATTACK_DMG_MULT', 'JUMP_MULT', 'DASH_SPEED_MULT', 'DASH_COOLDOWN_MULT');

-- CreateTable
CREATE TABLE "BrawlerPowerupDefinition" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "effectType" "BrawlerPowerupEffectType" NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "spawnWeight" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrawlerPowerupDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrawlerPowerupDefinition_enabled_idx" ON "BrawlerPowerupDefinition"("enabled");

-- CreateIndex
CREATE INDEX "BrawlerPowerupDefinition_effectType_idx" ON "BrawlerPowerupDefinition"("effectType");
