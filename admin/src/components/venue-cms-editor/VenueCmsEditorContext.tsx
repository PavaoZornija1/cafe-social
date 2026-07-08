"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  type AdminVenueDetail,
  useAdminVenueDetailQuery,
  usePortalMeQuery,
} from "@/lib/queries";
import {
  partnerVenueMutationsBlockedNotice,
  type PartnerReadOnlyNotice,
} from "@/lib/partnerReadOnlyMessages";

type VenueCmsEditorContextValue = {
  venueId: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  venue: AdminVenueDetail | null;
  isSuperAdmin: boolean;
  readOnlyNotice: PartnerReadOnlyNotice | null;
  readOnlyDisabled: boolean;
  shellLoading: boolean;
  loadError: string | null;
  title: string;
};

const VenueCmsEditorContext = createContext<VenueCmsEditorContextValue | null>(
  null,
);

export function VenueCmsEditorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const params = useParams();
  const venueId = params.id as string;
  const { getToken, isLoaded } = useAuth();

  const venueQ = useAdminVenueDetailQuery(venueId, getToken, Boolean(isLoaded && venueId));
  const meQ = usePortalMeQuery(getToken, isLoaded);

  const isSuperAdmin = meQ.data?.platformRole === "SUPER_ADMIN";
  const venue = venueQ.data ?? null;

  const loadError =
    venueQ.isError && venueQ.error instanceof Error
      ? venueQ.error.message
      : null;

  const shellLoading = venueQ.isPending;
  const title = venue?.name ?? t("admin.venueCms.editor.loading");

  const readOnlyNotice = useMemo((): PartnerReadOnlyNotice | null => {
    if (isSuperAdmin || !venue) return null;
    return partnerVenueMutationsBlockedNotice({
      locked: venue.locked,
      lockReason: venue.lockReason,
      organization: null,
    });
  }, [isSuperAdmin, venue]);
  const readOnlyDisabled = Boolean(readOnlyNotice);

  const value = useMemo(
    (): VenueCmsEditorContextValue => ({
      venueId,
      getToken,
      isLoaded,
      venue,
      isSuperAdmin,
      readOnlyNotice,
      readOnlyDisabled,
      shellLoading,
      loadError,
      title,
    }),
    [
      venueId,
      getToken,
      isLoaded,
      venue,
      isSuperAdmin,
      readOnlyNotice,
      readOnlyDisabled,
      shellLoading,
      loadError,
      title,
    ],
  );

  return (
    <VenueCmsEditorContext.Provider value={value}>
      {children}
    </VenueCmsEditorContext.Provider>
  );
}

export function useVenueCmsEditor(): VenueCmsEditorContextValue {
  const ctx = useContext(VenueCmsEditorContext);
  if (!ctx) {
    throw new Error("useVenueCmsEditor must be used within VenueCmsEditorProvider");
  }
  return ctx;
}
