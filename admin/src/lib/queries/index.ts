"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  fetchPortalMe,
  ownerFetch,
  ownerJson,
  partnerOnboardingBootstrap,
  portalFetch,
  type PartnerOnboardingPayload,
  type PortalMeResponse,
} from "@/lib/portalApi";
import { queryKeys } from "./keys";

export { queryKeys };

export function usePortalMeQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
  options?: Omit<UseQueryOptions<PortalMeResponse>, "queryKey" | "queryFn" | "enabled">,
) {
  return useQuery({
    queryKey: queryKeys.portal.me,
    queryFn: () => fetchPortalMe(getToken),
    enabled,
    ...options,
  });
}

export type AdminVenueListRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  organizationId: string | null;
  menuUrl?: string | null;
  orderingUrl?: string | null;
  featuredOfferTitle?: string | null;
  locked?: boolean;
};

export type AdminOrgListRow = {
  id: string;
  name: string;
  slug: string | null;
  locationKind: string;
  trialEndsAt: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  billingPortalUrl: string | null;
  _count?: { venues: number };
};

export type AdminVenueDetail = {
  id: string;
  name: string;
  menuUrl: string | null;
  orderingUrl: string | null;
  orderNudgeTitle: string | null;
  orderNudgeBody: string | null;
  featuredOfferTitle: string | null;
  featuredOfferBody: string | null;
  featuredOfferEndsAt: string | null;
  analyticsTimeZone?: string | null;
  organizationId: string | null;
  locked: boolean;
  lockReason: string | null;
};

export type AdminVenueStaffRow = {
  id: string;
  playerId: string;
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  player: { id: string; email: string; username: string };
};

export function useAdminVenuesQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.venues,
    queryFn: () =>
      portalFetch<AdminVenueListRow[]>(getToken, "/admin/venues", { method: "GET" }),
    enabled,
  });
}

export function useAdminOrganizationsQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.organizations,
    queryFn: () =>
      portalFetch<AdminOrgListRow[]>(getToken, "/admin/organizations", { method: "GET" }),
    enabled,
  });
}

export function useAdminOrganizationDetailQuery(
  id: string | undefined,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.organization(id ?? ""),
    queryFn: () =>
      portalFetch<Record<string, unknown>>(getToken, `/admin/organizations/${id}`, {
        method: "GET",
      }),
    enabled: Boolean(enabled && id),
  });
}

export function useAdminVenueDetailQuery(
  id: string | undefined,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.venue(id ?? ""),
    queryFn: () =>
      portalFetch<AdminVenueDetail>(getToken, `/admin/venues/${id}`, { method: "GET" }),
    enabled: Boolean(enabled && id),
  });
}

export function useAdminVenueStaffQuery(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.venueStaff(venueId ?? ""),
    queryFn: () =>
      portalFetch<AdminVenueStaffRow[]>(getToken, `/admin/venues/${venueId}/staff`, {
        method: "GET",
      }),
    enabled: Boolean(enabled && venueId),
  });
}

export function useSuperAdminVenuePickerQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.owner.superAdminVenuePicker,
    queryFn: () =>
      portalFetch<{ id: string; name: string; city: string | null; country: string | null }[]>(
        getToken,
        "/owner/super-admin/venue-picker",
        { method: "GET" },
      ),
    enabled,
  });
}

export function useWordsQuery(getToken: () => Promise<string | null>, enabled: boolean, take = 80) {
  return useQuery({
    queryKey: queryKeys.admin.words(take),
    queryFn: () =>
      portalFetch<{ id: string; text: string; language: string; category: string }[]>(
        getToken,
        `/admin/words?take=${take}`,
        { method: "GET" },
      ),
    enabled,
  });
}

export function useVenuePerksQuery(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.perks(venueId ?? ""),
    queryFn: () =>
      portalFetch<
        { id: string; code: string; title: string; redemptionCount: number }[]
      >(getToken, `/admin/venues/${venueId}/perks`, { method: "GET" }),
    enabled: Boolean(enabled && venueId),
  });
}

export function useVenueChallengesQuery(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.challenges(venueId ?? ""),
    queryFn: () =>
      portalFetch<
        { id: string; title: string; activeFrom: string | null; activeTo: string | null }[]
      >(getToken, `/admin/venues/${venueId}/challenges`, { method: "GET" }),
    enabled: Boolean(enabled && venueId),
  });
}

export function useOwnerVenuesListQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.owner.venuesList,
    queryFn: () =>
      ownerJson<{
        platformRole?: string;
        actingPartnerVenueId?: string | null;
        venues: {
          role: "EMPLOYEE" | "MANAGER" | "OWNER";
          venue: {
            id: string;
            name: string;
            city: string | null;
            country: string | null;
            address: string | null;
            organizationId: string | null;
            locked: boolean;
            lockReason: string | null;
            organization: {
              id: string;
              name: string;
              billingPortalUrl: string | null;
              platformBillingPlan: string | null;
              platformBillingStatus: string;
              platformBillingRenewsAt: string | null;
              platformBillingSyncedAt: string | null;
              trialEndsAt: string | null;
            } | null;
          };
        }[];
      }>(getToken, "/owner/venues", { method: "GET" }),
    enabled,
  });
}

export function useStaffRedemptionsQuery(
  venueId: string | undefined,
  dateYmd: string,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.owner.venueRedemptions(venueId ?? "", dateYmd),
    queryFn: () => {
      const q = new URLSearchParams({ date: dateYmd });
      return ownerJson<{
        venueName: string;
        date: string;
        redemptions: {
          redemptionId: string;
          staffVerificationCode: string;
          redeemedAt: string;
          perkCode: string;
          perkTitle: string;
          voidedAt: string | null;
          voidReason: string | null;
          staffAcknowledgedAt: string | null;
        }[];
      }>(getToken, `/owner/venues/${venueId}/redemptions?${q}`, { method: "GET" });
    },
    enabled: Boolean(enabled && venueId),
  });
}

export type OwnerOrganizationAnalytics = {
  organizationId: string;
  venueCount: number;
  venues: { id: string; name: string }[];
  analyticsTimeZone: string | null;
  period: { days: number; startDay: string; endDay: string };
  redemptions: {
    total: number;
    voided: number;
    byDay: { day: string; count: number }[];
    byHourUtc: { hour: number; count: number }[];
    byHourVenue: { hour: number; count: number }[] | null;
    perPerk: { perkId: string; code: string; title: string; count: number }[];
  };
  visits: {
    uniquePlayers: number;
    totalVisitDays: number;
    uniquePlayerDays: number;
    byDay: { day: string; count: number }[];
  };
  funnel: {
    uniqueVisitors: number;
    uniqueRedeemers: number;
    totalRedemptions: number;
    visitToRedeemPercent: number;
  };
  feedEvents: { total: number; byKind: Record<string, number> };
};

/** Owner franchise rollup — `/owner/organizations/:id/analytics` */
export function useOwnerOrganizationAnalyticsQuery(
  organizationId: string | undefined,
  days: number,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.owner.orgAnalytics(organizationId ?? "", days),
    queryFn: () =>
      ownerJson<OwnerOrganizationAnalytics>(
        getToken,
        `/owner/organizations/${organizationId}/analytics?days=${days}`,
        { method: "GET" },
      ),
    enabled: Boolean(enabled && organizationId),
  });
}

/** For super-admin org detail — venues list matches `/admin/venues` shape used there. */
export function useAdminVenuesForOrgLinkQuery(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...queryKeys.admin.venues, "org-link"] as const,
    queryFn: () =>
      portalFetch<AdminVenueListRow[]>(getToken, "/admin/venues", { method: "GET" }),
    enabled,
  });
}

export function useInvalidatePartnerContext() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.portal.me });
    void qc.invalidateQueries({ queryKey: queryKeys.owner.venuesList });
    void qc.invalidateQueries({ queryKey: queryKeys.owner.superAdminVenuePicker });
  };
}

export function useAddWordMutation(
  getToken: () => Promise<string | null>,
  take = 80,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      text: string;
      language: string;
      category: string;
      sentenceHint: string;
      wordHints: string[];
      emojiHints: string[];
    }) =>
      portalFetch(getToken, "/admin/words", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.words(take) });
    },
  });
}

export function useCreateOrganizationMutation(getToken: () => Promise<string | null>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      portalFetch(getToken, "/admin/organizations", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.organizations });
    },
  });
}

export function useCreatePerkMutation(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; title: string; requiresQrUnlock: boolean }) =>
      portalFetch(getToken, `/admin/venues/${venueId}/perks`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (venueId) void qc.invalidateQueries({ queryKey: queryKeys.admin.perks(venueId) });
    },
  });
}

export function useDeletePerkMutation(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (perkId: string) =>
      portalFetch(getToken, `/admin/perks/${perkId}`, { method: "DELETE" }),
    onSuccess: () => {
      if (venueId) void qc.invalidateQueries({ queryKey: queryKeys.admin.perks(venueId) });
    },
  });
}

export function usePatchChallengeMutation(getToken: () => Promise<string | null>, venueId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { activeFrom: string | null; activeTo: string | null };
    }) =>
      portalFetch(getToken, `/admin/challenges/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (venueId) void qc.invalidateQueries({ queryKey: queryKeys.admin.challenges(venueId) });
    },
  });
}

export function useAdminVenuePatchMutation(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      portalFetch(getToken, `/admin/venues/${venueId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (venueId) {
        void qc.invalidateQueries({ queryKey: queryKeys.admin.venue(venueId) });
        void qc.invalidateQueries({ queryKey: queryKeys.admin.venues });
      }
    },
  });
}

export function useAdminVenueStaffUpsertMutation(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      portalFetch(getToken, `/admin/venues/${venueId}/staff`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (venueId) void qc.invalidateQueries({ queryKey: queryKeys.admin.venueStaff(venueId) });
    },
  });
}

export function useAdminVenueStaffRemoveMutation(
  venueId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) =>
      portalFetch(getToken, `/admin/venues/${venueId}/staff/${playerId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      if (venueId) void qc.invalidateQueries({ queryKey: queryKeys.admin.venueStaff(venueId) });
    },
  });
}

export function useAdminOrganizationPatchMutation(
  orgId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      portalFetch(getToken, `/admin/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (orgId) {
        void qc.invalidateQueries({ queryKey: queryKeys.admin.organization(orgId) });
        void qc.invalidateQueries({ queryKey: queryKeys.admin.organizations });
      }
    },
  });
}

export function useAdminOrganizationVenuesLinkMutation(
  orgId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { attachVenueIds: string[]; detachVenueIds: string[] }) =>
      portalFetch(getToken, `/admin/organizations/${orgId}/venues`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (orgId) {
        void qc.invalidateQueries({ queryKey: queryKeys.admin.organization(orgId) });
        void qc.invalidateQueries({ queryKey: queryKeys.admin.venues });
      }
    },
  });
}

export function useAdminOrganizationDeleteMutation(
  orgId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      portalFetch(getToken, `/admin/organizations/${orgId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.organizations });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.venues });
    },
  });
}

export function useAcceptStaffInviteMutation(getToken: () => Promise<string | null>) {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await ownerFetch(getToken, "/owner/accept-staff-invite", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      return text ? (JSON.parse(text) as { venueName?: string; role?: string }) : {};
    },
  });
}

export function usePartnerOnboardingMutation(getToken: () => Promise<string | null>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PartnerOnboardingPayload) =>
      partnerOnboardingBootstrap(getToken, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.portal.me });
    },
  });
}
