-- Post-game carousel snapshots (per participant / solo session).
ALTER TABLE "GameParticipant" ADD COLUMN "postGameSnapshot" JSONB;

ALTER TABLE "GameSession" ADD COLUMN "postGameProcessedAt" TIMESTAMP(3);

ALTER TABLE "SoloWordSession" ADD COLUMN "postGameSnapshot" JSONB;
