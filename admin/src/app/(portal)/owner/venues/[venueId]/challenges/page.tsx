"use client";

import { VenueChallengesSection } from "@/components/venue-cms/VenueChallengesSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueChallengesPage() {
  useVenueSectionGuard("analytics");
  const { venueId, getToken, isLoaded, metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return (
    <VenueChallengesSection
      venueId={venueId}
      getToken={getToken}
      enabled={Boolean(isLoaded && venueId)}
      variant="embedded"
    />
  );
}
