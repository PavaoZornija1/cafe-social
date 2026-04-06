"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { VenuePerksSection } from "@/components/venue-cms/VenuePerksSection";

export default function PerksAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  if (!venueId) return null;
  return (
    <VenuePerksSection
      venueId={venueId}
      getToken={getToken}
      enabled={isLoaded}
      variant="page"
    />
  );
}
