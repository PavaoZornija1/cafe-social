"use client";

import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@/lib/portalApi";

export type PlatformMetrics = {
  organizationCount: number;
  venueCount: number;
  lockedVenueCount: number;
  pastDueOrUnpaidOrgCount: number;
  canceledBillingOrgCount: number;
};

export function usePlatformMetrics(getToken: () => Promise<string | null>, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "dashboard", "metrics"] as const,
    queryFn: () =>
      portalFetch<PlatformMetrics>(getToken, "/admin/dashboard/metrics", { method: "GET" }),
    enabled,
  });
}
