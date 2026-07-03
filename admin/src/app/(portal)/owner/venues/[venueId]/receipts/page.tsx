"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { VenueReceiptsSection } from "@/components/owner-venue-dashboard/sections/VenueReceiptsSection";
import {
  useOwnerVenueDashboard,
  useVenueSectionGuard,
} from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";
import { isReceiptSubmissionsEnabled } from "@/lib/receiptSubmissionsFeature";

export default function OwnerVenueReceiptsPage() {
  useVenueSectionGuard("analytics");
  const { metaRow, canAnalytics, venueId } = useOwnerVenueDashboard();
  const router = useRouter();

  useEffect(() => {
    if (!isReceiptSubmissionsEnabled()) {
      router.replace(`/owner/venues/${venueId}`);
    }
  }, [router, venueId]);

  if (!metaRow || !canAnalytics || !isReceiptSubmissionsEnabled()) return null;

  return <VenueReceiptsSection />;
}
