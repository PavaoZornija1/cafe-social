"use client";

import { VenueCampaignsSection } from "@/components/owner-venue-dashboard/sections/VenueCampaignsSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueCampaignsPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return <VenueCampaignsSection />;
}
