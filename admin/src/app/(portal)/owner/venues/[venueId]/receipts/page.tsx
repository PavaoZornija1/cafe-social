"use client";

import { VenueReceiptsSection } from "@/components/owner-venue-dashboard/sections/VenueReceiptsSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueReceiptsPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return <VenueReceiptsSection />;
}
