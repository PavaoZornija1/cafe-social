"use client";

import { VenueCmsEditorProvider } from "@/components/venue-cms-editor/VenueCmsEditorContext";
import { VenueCmsEditorShell } from "@/components/venue-cms-editor/VenueCmsEditorShell";

export default function VenueCmsEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VenueCmsEditorProvider>
      <VenueCmsEditorShell>{children}</VenueCmsEditorShell>
    </VenueCmsEditorProvider>
  );
}
