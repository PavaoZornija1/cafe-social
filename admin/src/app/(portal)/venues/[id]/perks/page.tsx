"use client";

import { VenuePerksSection } from "@/components/venue-cms/VenuePerksSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsPerksPage() {
  const { venueId, getToken, isLoaded, venue } = useVenueCmsEditor();
  if (!venue) return null;

  return (
    <VenuePerksSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
      variant="page"
    />
  );
}
