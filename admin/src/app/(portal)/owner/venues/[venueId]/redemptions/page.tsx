"use client";

import { VenueRedemptionsSection } from "@/components/owner-venue-dashboard/sections/VenueRedemptionsSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueRedemptionsPage() {
  useVenueSectionGuard("any");
  const { metaRow } = useOwnerVenueDashboard();

  if (!metaRow) return null;

  return <VenueRedemptionsSection />;
}
