"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PartnerReadOnlyBanner, noticeKey } from "@/components/PartnerReadOnlyBanner";
import { uniquePartnerReadOnlyNotices } from "@/lib/partnerReadOnlyMessages";
import {
  isManagementRole,
  partnerHasManagementAccess,
  venuePortalHomePath,
} from "@/lib/partnerRoles";
import { useInvalidatePartnerContext, useOwnerVenuesListQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/queries/keys";
import { PORTAL_VENUE_CONTEXT_EVENT } from "@/lib/portalVenueContext";

type VenueRow = {
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
};

function formatVenueLocation(row: VenueRow): string | null {
  const parts = [row.venue.address, row.venue.city, row.venue.country].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function OwnerVenuesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const qc = useQueryClient();
  const invalidatePartner = useInvalidatePartnerContext();
  const [redirecting, setRedirecting] = useState(false);

  const venuesQ = useOwnerVenuesListQuery(getToken, isLoaded);

  useEffect(() => {
    const fn = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.owner.venuesList });
      invalidatePartner();
    };
    window.addEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
    return () => window.removeEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
  }, [qc, invalidatePartner]);

  const venues = venuesQ.data?.venues ?? null;
  const platformRole = venuesQ.data?.platformRole ?? null;
  const actingPartnerVenueId = venuesQ.data?.actingPartnerVenueId ?? null;

  const isSuperAdmin = platformRole === "SUPER_ADMIN";
  const staffOnly = Boolean(venues?.length && !partnerHasManagementAccess(venues));

  useEffect(() => {
    if (!isLoaded || venuesQ.isPending || !venues?.length) return;
    if (isSuperAdmin && !actingPartnerVenueId) return;
    if (venues.length !== 1) return;

    const row = venues[0] as VenueRow;
    setRedirecting(true);
    router.replace(venuePortalHomePath(row.role, row.venue.id));
  }, [
    isLoaded,
    venuesQ.isPending,
    venues,
    isSuperAdmin,
    actingPartnerVenueId,
    router,
  ]);

  const error =
    venuesQ.isError && venuesQ.error instanceof Error ? venuesQ.error.message : null;

  const readOnlyNotices = useMemo(() => {
    if (!venues?.length || staffOnly) return [];
    const snaps = venues.map((row) => ({
      locked: row.venue.locked,
      lockReason: row.venue.lockReason ?? null,
      organization: row.venue.organization
        ? {
            platformBillingStatus: row.venue.organization.platformBillingStatus,
            trialEndsAt: row.venue.organization.trialEndsAt ?? null,
          }
        : null,
    }));
    return uniquePartnerReadOnlyNotices(
      snaps,
      platformRole ?? "NONE",
      actingPartnerVenueId,
    );
  }, [venues, platformRole, actingPartnerVenueId, staffOnly]);

  const groups = useMemo(() => {
    if (!venues?.length) return [];
    const byOrg = new Map<string, { label: string; orgId: string | null; rows: VenueRow[] }>();
    for (const row of venues as VenueRow[]) {
      const orgId = row.venue.organizationId;
      const key = orgId ?? `__single:${row.venue.id}`;
      const label =
        row.venue.organization?.name ??
        (orgId
          ? t("admin.partnerVenues.organizationFallback")
          : t("admin.partnerVenues.independentVenues"));
      if (!byOrg.has(key)) {
        byOrg.set(key, { label, orgId, rows: [] });
      }
      byOrg.get(key)!.rows.push(row);
    }
    return [...byOrg.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [venues, t]);

  const showLoading =
    !isLoaded || venuesQ.isPending || redirecting || (venues?.length === 1 && !isSuperAdmin);

  const pageTitle = isSuperAdmin
    ? t("admin.partnerVenues.titleSuperAdmin")
    : staffOnly
      ? t("admin.partnerVenues.titleStaff")
      : t("admin.partnerVenues.titleLocations");

  const pageLead = isSuperAdmin
    ? t("admin.partnerVenues.leadSuperAdmin")
    : staffOnly
      ? t("admin.partnerVenues.leadStaff")
      : t("admin.partnerVenues.leadManagement");

  return (
    <div className="bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">{pageLead}</p>
      </header>

      <main className="p-6 max-w-2xl space-y-4">
        {showLoading ? (
          <p className="text-slate-600">{t("admin.partnerVenues.loading")}</p>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        ) : null}
        {readOnlyNotices.map((notice) => (
          <PartnerReadOnlyBanner key={noticeKey(notice)} notice={notice} />
        ))}
        {venues && venues.length === 0 && !error && !showLoading && (
          <p className="text-slate-600 leading-relaxed">
            {isSuperAdmin
              ? t("admin.partnerVenues.emptySuperAdmin")
              : t("admin.partnerVenues.emptyPartner")}
          </p>
        )}
        {venues && venues.length > 1 && !showLoading && (
          <ul className="mt-2 space-y-3">
            {groups.flatMap((g) => {
              const canSeeOrgRollup =
                Boolean(g.orgId) &&
                (isSuperAdmin || g.rows.some((r) => isManagementRole(r.role)));
              const showOrgHeader =
                Boolean(g.orgId) &&
                (g.rows.length > 1 || groups.filter((x) => x.orgId).length > 1);

              const header =
                showOrgHeader && g.orgId ? (
                  <li key={`hdr-${g.orgId}`} className="list-none pt-4 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {g.label}
                      </p>
                      {canSeeOrgRollup ? (
                        <Link
                          href={`/owner/organizations/${g.orgId}`}
                          className="text-xs text-amber-700 hover:underline"
                        >
                          {t("admin.partnerVenues.orgAllLocations")}
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ) : null;

              const items = g.rows.map((row) => {
                const location = formatVenueLocation(row);
                const href = venuePortalHomePath(row.role, row.venue.id);
                const showRoleBadge = venues.length > 1;

                return (
                  <li key={row.venue.id}>
                    <Link
                      href={href}
                      className="block rounded-xl border border-slate-200 bg-white hover:border-brand/40 hover:shadow-sm transition px-4 py-4"
                    >
                      <div className="flex justify-between gap-3 items-start">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                            {row.venue.name}
                            {row.venue.locked ? (
                              <span className="text-[10px] font-medium text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                                {t("admin.partnerVenues.lockedInactive")}
                              </span>
                            ) : null}
                          </p>
                          {location ? (
                            <p className="text-sm text-slate-500 mt-1">{location}</p>
                          ) : null}
                        </div>
                        {showRoleBadge ? (
                          <span className="text-xs font-medium text-brand bg-brand-light px-2.5 py-1 rounded-full shrink-0">
                            {t(`admin.partnerVenueDetail.roles.${row.role}`)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              });

              return header ? [header, ...items] : items;
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
