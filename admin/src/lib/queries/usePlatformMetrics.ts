"use client";

import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@/lib/portalApi";
import { queryKeys } from "./keys";

export type PlatformMetrics = {
  organizationCount: number;
  singleLocationOrganizationCount: number;
  multiLocationOrganizationCount: number;
  venueCount: number;
  venuesInSingleLocationOrganizations: number;
  venuesInMultiLocationOrganizations: number;
  venuesWithoutOrganization: number;
  lockedVenueCount: number;
  lockedVenuesInSingleLocationOrganizations: number;
  lockedVenuesInMultiLocationOrganizations: number;
  lockedVenuesWithoutOrganization: number;
  pastDueOrUnpaidOrgCount: number;
  pastDueOrUnpaidSingleLocationOrgCount: number;
  pastDueOrUnpaidMultiLocationOrgCount: number;
  canceledBillingOrgCount: number;
  canceledBillingSingleLocationOrgCount: number;
  canceledBillingMultiLocationOrgCount: number;
};

export function usePlatformMetrics(getToken: () => Promise<string | null>, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.dashboardMetrics,
    queryFn: () =>
      portalFetch<PlatformMetrics>(getToken, "/admin/dashboard/metrics", { method: "GET" }),
    enabled,
  });
}
