"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { VenueChallengesSection } from "@/components/venue-cms/VenueChallengesSection";

export default function ChallengesAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  if (!venueId) return null;
  return (
    <VenueChallengesSection
      venueId={venueId}
      getToken={getToken}
      enabled={isLoaded}
      variant="page"
    />
  );
}
