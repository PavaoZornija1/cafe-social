"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { uniquePartnerReadOnlyMessages } from "@/lib/partnerVenueReadOnly";
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

export default function OwnerVenuesPage() {
  const { getToken, isLoaded } = useAuth();
  const qc = useQueryClient();
  const invalidatePartner = useInvalidatePartnerContext();

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

  const error =
    venuesQ.isError && venuesQ.error instanceof Error ? venuesQ.error.message : null;

  const readOnlyBannerMessages = useMemo(() => {
    if (!venues?.length) return [];
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
    return uniquePartnerReadOnlyMessages(
      snaps,
      platformRole ?? "NONE",
      actingPartnerVenueId,
    );
  }, [venues, platformRole, actingPartnerVenueId]);

  return (
    <div className="bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-semibold">Venue dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          {platformRole === "SUPER_ADMIN"
            ? "Super admin — pick a venue in the sidebar to open the partner dashboard for that location."
            : "Analytics and redemptions for venues you manage."}
        </p>
      </header>

      <main className="p-6 max-w-2xl space-y-4">
        {!isLoaded || venuesQ.isPending ? <p className="text-slate-600">Loading…</p> : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        ) : null}
        {readOnlyBannerMessages.map((msg) => (
          <PartnerReadOnlyBanner key={msg} message={msg} />
        ))}
        {venues && venues.length === 0 && !error && (
          <p className="text-slate-600">
            {platformRole === "SUPER_ADMIN"
              ? "No venue context selected. Use “Partner dashboard context” in the sidebar to act as a specific venue."
              : "No venues yet. A platform admin must add your Clerk email to a venue as OWNER, MANAGER, or EMPLOYEE."}
          </p>
        )}
        {venues && venues.length > 0 && (
          <ul className="mt-6 space-y-3">
            {(() => {
              const byOrg = new Map<
                string,
                { label: string; orgId: string | null; rows: VenueRow[] }
              >();
              for (const row of venues) {
                const orgId = row.venue.organizationId;
                const key = orgId ?? `__single:${row.venue.id}`;
                const label =
                  row.venue.organization?.name ??
                  (orgId ? "Franchise" : "Independent venues");
                if (!byOrg.has(key)) {
                  byOrg.set(key, { label, orgId, rows: [] });
                }
                byOrg.get(key)!.rows.push(row);
              }
              const groups = [...byOrg.values()].sort((a, b) =>
                a.label.localeCompare(b.label),
              );
              return groups.flatMap((g) => {
                const canSeeOrgRollup =
                  platformRole === "SUPER_ADMIN" ||
                  g.rows.some(
                    (r) => r.role === "MANAGER" || r.role === "OWNER",
                  );
                const header = g.orgId ? (
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
                          Rollup analytics →
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Ask an owner for franchise analytics
                        </span>
                      )}
                    </div>
                  </li>
                ) : null;
                const items = g.rows.map((row) => (
                  <li key={row.venue.id}>
                    <Link
                      href={`/owner/venues/${row.venue.id}`}
                      className="block rounded-xl border border-slate-200 bg-slate-100 hover:border-brand/40 transition px-4 py-4"
                    >
                      <div className="flex justify-between gap-3 items-start">
                        <div>
                          <p className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                            {row.venue.name}
                            {row.venue.locked ? (
                              <span className="text-[10px] font-mono uppercase text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                                Locked
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {[row.venue.address, row.venue.city, row.venue.country]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <span className="text-xs font-mono uppercase tracking-wide text-brand bg-brand-light px-2 py-1 rounded shrink-0">
                          {row.role}
                        </span>
                      </div>
                    </Link>
                    <div className="mt-2 text-sm">
                      <Link
                        href={`/staff/${row.venue.id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        Today&apos;s redemptions only →
                      </Link>
                    </div>
                  </li>
                ));
                return header ? [header, ...items] : items;
              });
            })()}
          </ul>
        )}
      </main>
    </div>
  );
}
