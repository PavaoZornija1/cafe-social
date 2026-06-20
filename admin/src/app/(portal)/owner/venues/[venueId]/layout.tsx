"use client";

import { OwnerVenueDashboardNav } from "@/components/owner-venue-dashboard/OwnerVenueDashboardNav";
import { OwnerVenueDashboardProvider } from "@/components/owner-venue-dashboard/OwnerVenueDashboardContext";
import { OwnerVenueDashboardShell } from "@/components/owner-venue-dashboard/OwnerVenueDashboardShell";

export default function OwnerVenueDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerVenueDashboardProvider>
      <OwnerVenueDashboardShell>
        <OwnerVenueDashboardNav />
        {children}
      </OwnerVenueDashboardShell>
    </OwnerVenueDashboardProvider>
  );
}
