"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { VenueCmsStaffSection } from "@/components/venue-cms-editor/sections/VenueCmsStaffSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsStaffPage() {
  const { venue, venueId, isSuperAdmin, shellLoading } = useVenueCmsEditor();
  const router = useRouter();

  // Partners manage staff via the Team invite flow, not direct CMS upsert.
  useEffect(() => {
    if (!shellLoading && !isSuperAdmin && venueId) {
      router.replace(`/owner/venues/${venueId}/team`);
    }
  }, [shellLoading, isSuperAdmin, venueId, router]);

  if (!venue || !isSuperAdmin) return null;
  return <VenueCmsStaffSection />;
}
