"use client";

import { VenueTeamSection } from "@/components/owner-venue-dashboard/sections/VenueTeamSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueTeamPage() {
  useVenueSectionGuard("owner");
  const { metaRow, isOwner } = useOwnerVenueDashboard();

  if (!metaRow || !isOwner) return null;

  return <VenueTeamSection />;
}
