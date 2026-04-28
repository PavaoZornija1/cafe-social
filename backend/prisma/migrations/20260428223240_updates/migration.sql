-- RenameForeignKey
ALTER TABLE "VenuePerkRedemption" RENAME CONSTRAINT "VenuePerkRedemption_staffAcknowledgedByPlayerId_fkey" TO "VenuePerkRedemption_redeemedByPlayerId_fkey";
