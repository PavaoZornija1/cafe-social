ALTER TABLE "VenuePerkRedemption"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'REDEEMABLE',
  ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "VenuePerkRedemption"
SET "expiresAt" = COALESCE("redeemedAt", NOW()) + INTERVAL '7 days'
WHERE "expiresAt" IS NULL;

ALTER TABLE "VenuePerkRedemption"
  ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "VenuePerkRedemption_status_idx" ON "VenuePerkRedemption"("status");
CREATE INDEX "VenuePerkRedemption_expiresAt_idx" ON "VenuePerkRedemption"("expiresAt");
