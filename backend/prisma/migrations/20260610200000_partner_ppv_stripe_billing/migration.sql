-- Partner pay-per-visit billing fields + Stripe usage idempotency on polygon sessions.

ALTER TABLE "VenueOrganization" ADD COLUMN "platformBillingModel" TEXT NOT NULL DEFAULT 'SUBSCRIPTION';
ALTER TABLE "VenueOrganization" ADD COLUMN "stripePpvSubscriptionItemId" TEXT;

ALTER TABLE "PlayerVenuePolygonSession" ADD COLUMN "stripeUsageReportedAt" TIMESTAMP(3);
