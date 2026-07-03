"use client";

import { VenuePerksSection } from "@/components/venue-cms/VenuePerksSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenuePerksPage() {
  useVenueSectionGuard("analytics");
  const { venueId, getToken, isLoaded, metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return (
    <VenuePerksSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
      variant="embedded"
    />
  );
}
