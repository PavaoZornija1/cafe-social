-- Restore FK dropped by the mis-ordered 20260703125944 migration on databases that applied it before reorder.
DO $$ BEGIN
  ALTER TABLE "VenueReceiptSubmission" ADD CONSTRAINT "VenueReceiptSubmission_linkedRedemptionId_fkey" FOREIGN KEY ("linkedRedemptionId") REFERENCES "VenuePerkRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
