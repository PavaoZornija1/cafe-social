"use client";

import { VenuePlaybookSection } from "@/components/owner-venue-dashboard/sections/VenuePlaybookSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenuePlaybookPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return <VenuePlaybookSection />;
}
