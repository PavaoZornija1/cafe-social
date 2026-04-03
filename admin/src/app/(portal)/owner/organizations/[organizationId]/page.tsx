'use client';

import Link from 'next/link';
import { UserButton, useAuth } from '@clerk/nextjs';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ownerFetch } from '@/lib/portalApi';
import { OwnerAnalyticsCharts } from '@/components/OwnerAnalyticsCharts';
import { PartnerReadOnlyBanner } from '@/components/PartnerReadOnlyBanner';
import {
  partnerOrganizationMutationsBlockedReason,
  partnerVenueMutationsBlockedReason,
} from '@/lib/partnerVenueReadOnly';
import { useOwnerOrganizationAnalyticsQuery, useOwnerVenuesListQuery } from '@/lib/queries';

type OrgAnalytics = {
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

type PortalVenueListRow = {
  role: string;
  venue: {
    organizationId: string | null;
    locked: boolean;
    lockReason: string | null;
    organization: {
      platformBillingStatus: string;
      trialEndsAt: string | null;
    } | null;
  };
};

const perkColHelper = createColumnHelper<OrgAnalytics['redemptions']['perPerk'][number]>();

export default function OwnerOrganizationPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { getToken, isLoaded } = useAuth();
  const [days, setDays] = useState(30);

  const analyticsQ = useOwnerOrganizationAnalyticsQuery(
    organizationId,
    days,
    getToken,
    Boolean(isLoaded && organizationId),
  );
  const venuesListQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));

  const analytics = analyticsQ.data ?? null;

  const orgReadOnlyMessage = useMemo(() => {
    const data = venuesListQ.data;
    if (!data) return null;
    const platformRole = data.platformRole ?? 'NONE';
    const actingId = data.actingPartnerVenueId ?? null;
    const rows = data.venues.filter(
      (r: PortalVenueListRow) => r.venue.organizationId === organizationId,
    );
    if (platformRole === 'SUPER_ADMIN' && !actingId) {
      return null;
    }
    const org = rows[0]?.venue.organization ?? null;
    const orgMsg = partnerOrganizationMutationsBlockedReason(org);
    if (orgMsg) return orgMsg;
    const venueMsg = rows
      .map((r: PortalVenueListRow) =>
        partnerVenueMutationsBlockedReason({
          locked: r.venue.locked,
          lockReason: r.venue.lockReason ?? null,
          organization: r.venue.organization ?? org,
        }),
      )
      .find((m) => m != null);
    return venueMsg ?? null;
  }, [venuesListQ.data, organizationId]);

  const hourSeries = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const readOnlyDisabled = Boolean(orgReadOnlyMessage);

  const perkRows = useMemo(
    () => analytics?.redemptions.perPerk.slice(0, 12) ?? [],
    [analytics],
  );

  const perkColumns = useMemo(
    () => [
      perkColHelper.display({
        id: 'perk',
        header: 'Perk',
        cell: ({ row }) => (
          <span>
            <span className="font-mono text-brand">{row.original.code}</span>{' '}
            <span className="text-slate-800">{row.original.title}</span>
          </span>
        ),
      }),
      perkColHelper.accessor('count', {
        header: 'Count',
        cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
      }),
    ],
    [],
  );

  const perkTable = useReactTable({
    data: perkRows,
    columns: perkColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  const exportCsv = async () => {
    if (readOnlyDisabled) return;
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(
      getToken,
      `/owner/organizations/${organizationId}/analytics/export.csv?days=${days}`,
      { method: 'GET' },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-redemptions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadErr =
    analyticsQ.isError && analyticsQ.error instanceof Error
      ? analyticsQ.error.message
      : null;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-full">
      <header className="border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between gap-3">
        <div>
          <Link href="/owner/venues" className="text-sm text-brand hover:underline">
            ← Venues
          </Link>
          <h1 className="text-xl font-semibold mt-2">Franchise rollup</h1>
          <p className="text-sm text-slate-600 mt-1 font-mono">{organizationId}</p>
        </div>
        <UserButton />
      </header>
      <main className="p-6 max-w-4xl">
        {!isLoaded || analyticsQ.isPending ? (
          <p className="text-slate-600">Loading…</p>
        ) : null}
        {loadErr ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {loadErr}
          </div>
        ) : null}
        {orgReadOnlyMessage ? (
          <PartnerReadOnlyBanner message={orgReadOnlyMessage} />
        ) : null}
        {analytics && analytics.venueCount === 0 ? (
          <p className="text-slate-600 mt-4">No venues are linked to this organization yet.</p>
        ) : null}
        {analytics && analytics.venueCount > 0 ? (
          <>
            <div className="flex flex-wrap gap-3 items-center mt-2">
              <label className="text-sm text-slate-600">
                Period (days)
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="ml-2 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={readOnlyDisabled}
                onClick={() => void exportCsv()}
                className="text-sm text-emerald-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export CSV (all locations)
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              Rolling up{' '}
              <span className="text-slate-800 font-medium">{analytics.venueCount}</span> venues:{' '}
              {analytics.venues.map((v) => v.name).join(' · ')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">Unique players (org)</p>
                <p className="text-xl font-semibold text-slate-900">{analytics.visits.uniquePlayers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">Redemptions</p>
                <p className="text-xl font-semibold text-slate-900">{analytics.redemptions.total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">Visit → redeem %</p>
                <p className="text-xl font-semibold text-slate-900">
                  {analytics.funnel.visitToRedeemPercent}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">Player-days (all sites)</p>
                <p className="text-xl font-semibold text-slate-900">
                  {analytics.visits.uniquePlayerDays}
                </p>
              </div>
            </div>
            <OwnerAnalyticsCharts
              title="Franchise trends"
              visitsByDay={analytics.visits.byDay}
              redemptionsByDay={analytics.redemptions.byDay}
              byHour={hourSeries}
            />
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Top perks (all locations)</h3>
              <div className="text-sm border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    {perkTable.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                        {hg.headers.map((h) => (
                          <th
                            key={h.id}
                            className="text-left px-3 py-2 text-xs font-semibold text-slate-600"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {perkTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 bg-slate-50 last:border-0">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
