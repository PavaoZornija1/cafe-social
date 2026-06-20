"use client";

import { VenueOffersSection } from "@/components/venue-cms/VenueOffersSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsOffersPage() {
  const { venueId, getToken, isLoaded, venue } = useVenueCmsEditor();
  if (!venue) return null;

  return (
    <VenueOffersSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
    />
  );
}
