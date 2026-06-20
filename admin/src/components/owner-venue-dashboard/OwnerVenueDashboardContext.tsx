"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { PORTAL_VENUE_CONTEXT_EVENT } from "@/lib/portalVenueContext";
import { partnerVenueMutationsBlockedNotice } from "@/lib/partnerReadOnlyMessages";
import type { PartnerReadOnlyNotice } from "@/lib/partnerReadOnlyMessages";
import { invalidateOwnerVenuePartnerQueries, useOwnerVenuesListQuery } from "@/lib/queries";
import type { VenueMetaRow } from "./types";

type OwnerVenueDashboardContextValue = {
  venueId: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  metaRow: VenueMetaRow | null;
  role: VenueMetaRow["role"] | null;
  venueName: string;
  canAnalytics: boolean;
  isOwner: boolean;
  readOnlyDisabled: boolean;
  readOnlyNotice: PartnerReadOnlyNotice | null;
  organizationRollupId: string | null;
  orgBilling: VenueMetaRow["venue"]["organization"];
  hidePartnerFinancialUi: boolean;
  platformRole: string | null;
  shellLoading: boolean;
  accessError: string | null;
  listErr: string | null;
  title: string;
  bannerError: string | null;
  setBannerError: (msg: string | null) => void;
};

const OwnerVenueDashboardContext = createContext<OwnerVenueDashboardContextValue | null>(
  null,
);

export function OwnerVenueDashboardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const params = useParams();
  const venueId = params.venueId as string;
  const { getToken, isLoaded } = useAuth();
  const qc = useQueryClient();
  const [bannerError, setBannerError] = useState<string | null>(null);

  const venuesListQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));

  const metaRow = useMemo((): VenueMetaRow | null => {
    const rows = venuesListQ.data?.venues;
    if (!rows) return null;
    const hit = rows.find((v) => v.venue.id === venueId);
    return (hit as VenueMetaRow | undefined) ?? null;
  }, [venuesListQ.data, venueId]);

  const role = metaRow?.role ?? null;
  const venueName = metaRow?.venue.name ?? "";
  const organizationRollupId = metaRow?.venue.organizationId ?? null;
  const orgBilling = metaRow?.venue.organization ?? null;
  const venueLocked = metaRow?.venue.locked ?? false;
  const venueLockReason = metaRow?.venue.lockReason ?? null;
  const platformRole = venuesListQ.data?.platformRole ?? null;
  const actingPartnerVenueId = venuesListQ.data?.actingPartnerVenueId ?? null;

  const canAnalytics = role === "OWNER" || role === "MANAGER";
  const isOwner = role === "OWNER";
  const hidePartnerFinancialUi =
    platformRole === "SUPER_ADMIN" && Boolean(actingPartnerVenueId);

  const readOnlyNotice = useMemo(() => {
    if (platformRole === "SUPER_ADMIN" && !actingPartnerVenueId) {
      return null;
    }
    return partnerVenueMutationsBlockedNotice({
      locked: venueLocked,
      lockReason: venueLockReason,
      organization: orgBilling
        ? {
            platformBillingStatus: orgBilling.platformBillingStatus,
            trialEndsAt: orgBilling.trialEndsAt ?? null,
          }
        : null,
    });
  }, [platformRole, actingPartnerVenueId, venueLocked, venueLockReason, orgBilling]);

  const readOnlyDisabled = Boolean(readOnlyNotice);

  useEffect(() => {
    const fn = () => invalidateOwnerVenuePartnerQueries(qc, venueId);
    window.addEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
    return () => window.removeEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
  }, [qc, venueId]);

  const accessError =
    venuesListQ.isSuccess && !metaRow
      ? t("admin.partnerVenueDetail.header.accessError")
      : null;

  const listErr =
    venuesListQ.isError && venuesListQ.error instanceof Error
      ? venuesListQ.error.message
      : null;

  const shellLoading = venuesListQ.isPending;
  const title = venueName || t("admin.partnerVenueDetail.header.fallbackVenueTitle");

  const value = useMemo(
    (): OwnerVenueDashboardContextValue => ({
      venueId,
      getToken,
      isLoaded,
      metaRow,
      role,
      venueName,
      canAnalytics,
      isOwner,
      readOnlyDisabled,
      readOnlyNotice,
      organizationRollupId,
      orgBilling,
      hidePartnerFinancialUi,
      platformRole,
      shellLoading,
      accessError,
      listErr,
      title,
      bannerError,
      setBannerError,
    }),
    [
      venueId,
      getToken,
      isLoaded,
      metaRow,
      role,
      venueName,
      canAnalytics,
      isOwner,
      readOnlyDisabled,
      readOnlyNotice,
      organizationRollupId,
      orgBilling,
      hidePartnerFinancialUi,
      platformRole,
      shellLoading,
      accessError,
      listErr,
      title,
      bannerError,
    ],
  );

  return (
    <OwnerVenueDashboardContext.Provider value={value}>
      {children}
    </OwnerVenueDashboardContext.Provider>
  );
}

export function useOwnerVenueDashboard(): OwnerVenueDashboardContextValue {
  const ctx = useContext(OwnerVenueDashboardContext);
  if (!ctx) {
    throw new Error("useOwnerVenueDashboard must be used within OwnerVenueDashboardProvider");
  }
  return ctx;
}

/** Redirect staff away from management-only sections. */
export function useVenueSectionGuard(required: "analytics" | "owner" | "any") {
  const { canAnalytics, isOwner, metaRow, role, venueId, shellLoading } =
    useOwnerVenueDashboard();
  const router = useRouter();

  useEffect(() => {
    if (shellLoading || !metaRow) return;
    if (required === "owner" && !isOwner) {
      router.replace(`/owner/venues/${venueId}/redemptions`);
      return;
    }
    if (required === "analytics" && !canAnalytics) {
      router.replace(`/owner/venues/${venueId}/redemptions`);
    }
  }, [required, canAnalytics, isOwner, metaRow, role, venueId, shellLoading, router]);
}
