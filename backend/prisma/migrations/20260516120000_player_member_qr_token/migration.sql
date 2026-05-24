-- Personal member QR token (scanned by staff at partner locations).
ALTER TABLE "Player" ADD COLUMN "memberQrToken" TEXT;

UPDATE "Player"
SET "memberQrToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "memberQrToken" IS NULL;

ALTER TABLE "Player" ALTER COLUMN "memberQrToken" SET NOT NULL;

CREATE UNIQUE INDEX "Player_memberQrToken_key" ON "Player"("memberQrToken");
