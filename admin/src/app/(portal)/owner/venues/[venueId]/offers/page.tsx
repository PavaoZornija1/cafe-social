"use client";

import { VenueOffersSection } from "@/components/venue-cms/VenueOffersSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueOffersPage() {
  useVenueSectionGuard("analytics");
  const { venueId, getToken, isLoaded, metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return (
    <VenueOffersSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
    />
  );
}
