"use client";

import { VenueChallengesSection } from "@/components/venue-cms/VenueChallengesSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsChallengesPage() {
  const { venueId, getToken, isLoaded, venue } = useVenueCmsEditor();
  if (!venue) return null;

  return (
    <VenueChallengesSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
      variant="page"
    />
  );
}
