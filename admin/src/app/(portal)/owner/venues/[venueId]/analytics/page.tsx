"use client";

import { VenueAnalyticsSection } from "@/components/owner-venue-dashboard/sections/VenueAnalyticsSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueAnalyticsPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return <VenueAnalyticsSection />;
}
