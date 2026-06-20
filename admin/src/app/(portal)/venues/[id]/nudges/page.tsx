"use client";

import { VenueNudgeSection } from "@/components/venue-cms/VenueNudgeSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsNudgesPage() {
  const { venueId, getToken, isLoaded, isSuperAdmin, venue } = useVenueCmsEditor();
  if (!venue) return null;

  return (
    <VenueNudgeSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
