"use client";

import { VenueCmsSettingsSection } from "@/components/venue-cms-editor/sections/VenueCmsSettingsSection";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";

export default function VenueCmsSettingsPage() {
  const { venue } = useVenueCmsEditor();
  if (!venue) return null;
  return <VenueCmsSettingsSection />;
}
