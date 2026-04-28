ALTER TABLE "VenuePerkRedemption"
  RENAME COLUMN "redeemedAt" TO "issuedAt";

ALTER TABLE "VenuePerkRedemption"
  RENAME COLUMN "staffAcknowledgedAt" TO "redeemedAt";

ALTER TABLE "VenuePerkRedemption"
  RENAME COLUMN "staffAcknowledgedByPlayerId" TO "redeemedByPlayerId";
