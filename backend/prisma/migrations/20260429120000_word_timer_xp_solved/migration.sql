-- Track correct-only solves for solo XP; co-op perfect-run detection.
ALTER TABLE "SoloWordSession" ADD COLUMN "wordsSolved" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WordSession" ADD COLUMN "wordsSolvedCount" INTEGER NOT NULL DEFAULT 0;
