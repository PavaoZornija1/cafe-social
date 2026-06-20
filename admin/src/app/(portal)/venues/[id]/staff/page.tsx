"use client";

import { VenueCmsStaffSection } from "@/components/venue-cms-editor/sections/VenueCmsStaffSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsStaffPage() {
  const { venue } = useVenueCmsEditor();
  if (!venue) return null;
  return <VenueCmsStaffSection />;
}
