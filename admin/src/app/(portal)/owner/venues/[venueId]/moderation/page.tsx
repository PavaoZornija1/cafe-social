"use client";

import { VenueModerationSection } from "@/components/owner-venue-dashboard/sections/VenueModerationSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";

export default function OwnerVenueModerationPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics } = useOwnerVenueDashboard();

  if (!metaRow || !canAnalytics) return null;

  return <VenueModerationSection />;
}
