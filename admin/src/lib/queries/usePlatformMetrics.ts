"use client";

import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@/lib/portalApi";
import { queryKeys } from "./keys";

export type PlatformMetrics = {
  organizationCount: number;
  venueCount: number;
  lockedVenueCount: number;
  pastDueOrUnpaidOrgCount: number;
  canceledBillingOrgCount: number;
};

export function usePlatformMetrics(getToken: () => Promise<string | null>, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.dashboardMetrics,
    queryFn: () =>
      portalFetch<PlatformMetrics>(getToken, "/admin/dashboard/metrics", { method: "GET" }),
    enabled,
  });
}
