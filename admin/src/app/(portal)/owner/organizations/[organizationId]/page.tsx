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
import { useTranslation } from 'react-i18next';
import { ownerFetch } from '@/lib/portalApi';
import { OwnerAnalyticsCharts } from '@/components/OwnerAnalyticsCharts';
import { OwnerAttributionSnapshot } from '@/components/OwnerAttributionSnapshot';
import { PartnerReadOnlyBanner } from '@/components/PartnerReadOnlyBanner';
import { PerkCountCards } from '@/components/TableRowCards';
import {
  partnerOrganizationMutationsBlockedNotice,
  partnerVenueMutationsBlockedNotice,
} from '@/lib/partnerReadOnlyMessages';
import {
  ownerAnalyticsQueryString,
  type OwnerOrganizationAnalytics,
  useOwnerOrganizationAnalyticsQuery,
  useOwnerVenuesListQuery,
} from '@/lib/queries';

type PortalVenueListRow = {
  role: string;
  venue: {
    organizationId: string | null;
    locked: boolean;
    lockReason: string | null;
    organization: {
      id: string;
      name: string;
      platformBillingStatus: string;
      trialEndsAt: string | null;
    } | null;
  };
};

const perkColHelper =
  createColumnHelper<OwnerOrganizationAnalytics['redemptions']['perPerk'][number]>();

export default function OwnerOrganizationPage() {
  const { t } = useTranslation();
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { getToken, isLoaded } = useAuth();
  const [days, setDays] = useState(30);
  const [fromYmd, setFromYmd] = useState('');
  const [toYmd, setToYmd] = useState('');

  const analyticsQ = useOwnerOrganizationAnalyticsQuery(
    organizationId,
    days,
    getToken,
    Boolean(isLoaded && organizationId),
    fromYmd.trim() || undefined,
    toYmd.trim() || undefined,
  );
  const venuesListQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));

  const analytics = analyticsQ.data ?? null;

  const orgDisplayName = useMemo(() => {
    const rows = venuesListQ.data?.venues ?? [];
    const match = rows.find(
      (r: PortalVenueListRow) => r.venue.organizationId === organizationId,
    );
    return match?.venue.organization?.name ?? null;
  }, [venuesListQ.data, organizationId]);

  const orgReadOnlyNotice = useMemo(() => {
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
    const orgNotice = partnerOrganizationMutationsBlockedNotice(org);
    if (orgNotice) return orgNotice;
    const venueNotice = rows
      .map((r: PortalVenueListRow) =>
        partnerVenueMutationsBlockedNotice({
          locked: r.venue.locked,
          lockReason: r.venue.lockReason ?? null,
          organization: r.venue.organization ?? org,
        }),
      )
      .find((n) => n != null);
    return venueNotice ?? null;
  }, [venuesListQ.data, organizationId]);

  const hourSeries = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const perkRows = useMemo(
    () => analytics?.redemptions.perPerk.slice(0, 12) ?? [],
    [analytics],
  );

  const perkColumns = useMemo(
    () => [
      perkColHelper.display({
        id: 'perk',
        header: t('admin.partnerOrgRollup.columns.perk'),
        cell: ({ row }) => (
          <span>
            <span className="font-mono text-brand">{row.original.code}</span>{' '}
            <span className="text-slate-800">{row.original.title}</span>
          </span>
        ),
      }),
      perkColHelper.accessor('count', {
        header: t('admin.partnerOrgRollup.columns.count'),
        cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
      }),
    ],
    [t],
  );

  const perkTable = useReactTable({
    data: perkRows,
    columns: perkColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  const analyticsQs = () =>
    ownerAnalyticsQueryString(days, fromYmd.trim() || undefined, toYmd.trim() || undefined);

  const exportCsv = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(
      getToken,
      `/owner/organizations/${organizationId}/analytics/export.csv?${analyticsQs()}`,
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

  const exportFunnelCsv = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(
      getToken,
      `/owner/organizations/${organizationId}/analytics/funnel-export.csv?${analyticsQs()}`,
      { method: 'GET' },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-funnel-events.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadErr =
    analyticsQ.isError && analyticsQ.error instanceof Error
      ? analyticsQ.error.message
      : null;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-full">
      <header className="border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-wrap justify-between gap-3">
        <div>
          <Link href="/owner/venues" className="text-sm text-brand hover:underline">
            {t('admin.partnerOrgRollup.backVenues')}
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {orgDisplayName ?? t('admin.partnerOrgRollup.title')}
          </h1>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            {t('admin.partnerOrgRollup.subtitle')}
            {' '}
            <Link
              href={`/owner/analytics?org=${encodeURIComponent(organizationId)}`}
              className="text-brand font-medium hover:underline"
            >
              {t('admin.partnerOrgRollup.analyticsHubLink')}
            </Link>
          </p>
          <details className="text-xs text-slate-500 mt-2">
            <summary className="cursor-pointer hover:text-slate-700">
              {t('admin.partnerOrgRollup.orgIdLabel')}
            </summary>
            <p className="font-mono mt-1 break-all">{organizationId}</p>
          </details>
        </div>
        <div className="hidden lg:block shrink-0">
          <UserButton />
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-4xl">
        {!isLoaded || analyticsQ.isPending ? (
          <p className="text-slate-600">{t('admin.partnerOrgRollup.loading')}</p>
        ) : null}
        {loadErr ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {loadErr}
          </div>
        ) : null}
        {orgReadOnlyNotice ? (
          <PartnerReadOnlyBanner notice={orgReadOnlyNotice} />
        ) : null}
        {analytics && analytics.venueCount === 0 ? (
          <p className="text-slate-600 mt-4">{t('admin.partnerOrgRollup.noVenues')}</p>
        ) : null}
        {analytics && analytics.venueCount > 0 ? (
          <>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mt-2">
              <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                {t('admin.partnerAnalytics.periodDays')}
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="sm:ml-2 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 w-full sm:w-auto"
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                {t('admin.partnerAnalytics.from')}
                <input
                  type="date"
                  value={fromYmd}
                  onChange={(e) => setFromYmd(e.target.value)}
                  className="sm:ml-2 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 w-full sm:w-auto"
                />
              </label>
              <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                {t('admin.partnerAnalytics.to')}
                <input
                  type="date"
                  value={toYmd}
                  onChange={(e) => setToYmd(e.target.value)}
                  className="sm:ml-2 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 w-full sm:w-auto"
                />
              </label>
              <button
                type="button"
                className="text-xs text-slate-500 hover:underline self-start"
                onClick={() => {
                  setFromYmd('');
                  setToYmd('');
                }}
              >
                {t('admin.partnerAnalytics.clearRange')}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('admin.partnerAnalytics.rangeHint')}
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mt-3">
              <button
                type="button"
                onClick={() => void exportCsv()}
                className="text-sm text-emerald-700 hover:underline"
              >
                {t('admin.partnerOrgRollup.exportRedemptionsCsv')}
              </button>
              <button
                type="button"
                onClick={() => void exportFunnelCsv()}
                className="text-sm text-emerald-700 hover:underline"
              >
                {t('admin.partnerOrgRollup.exportFunnelCsv')}
              </button>
            </div>
            {analytics ? (
              <p className="text-xs text-slate-500 mt-2">
                {t('admin.partnerOrgRollup.rangeLine', {
                  startDay: analytics.period.startDay,
                  endDay: analytics.period.endDay,
                })}
                {analytics.analyticsTimeZone
                  ? t('admin.partnerOrgRollup.sampleTz', {
                      timeZone: analytics.analyticsTimeZone,
                    })
                  : ''}
              </p>
            ) : null}
            <p className="text-sm text-slate-500 mt-4 line-clamp-3 sm:line-clamp-none">
              {t('admin.partnerOrgRollup.rollingUp', { count: analytics.venueCount })}{' '}
              {analytics.venues.map((v) => v.name).join(' · ')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">
                  {t('admin.partnerAnalytics.uniquePlayersOrg')}
                </p>
                <p className="text-xl font-semibold text-slate-900">{analytics.visits.uniquePlayers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">{t('admin.partnerAnalytics.redemptions')}</p>
                <p className="text-xl font-semibold text-slate-900">{analytics.redemptions.total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">
                  {t('admin.partnerAnalytics.visitRedeemPct')}
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {analytics.funnel.visitToRedeemPercent}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">{t('admin.partnerAnalytics.playerDays')}</p>
                <p className="text-xl font-semibold text-slate-900">
                  {analytics.visits.uniquePlayerDays}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
                <p className="text-xs text-slate-500">
                  {t('admin.partnerAnalytics.repeatVisitors')}
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {analytics.visits.loyalty.repeatVisitPlayers}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {t('admin.partnerOrgRollup.repeatVisitorsDetail', {
                    percent: analytics.visits.loyalty.shareRepeatVisitorsPercent,
                    avg: analytics.visits.loyalty.avgVisitDaysPerPlayer,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                {t('admin.partnerAnalytics.funnelJourneyTitle')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">{t('admin.partnerAnalytics.detectImp')}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {analytics.funnelJourney.detectImpressions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {t('admin.partnerAnalytics.uniqueEntered')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {analytics.funnelJourney.uniqueEntered}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.partnerAnalytics.uniquePlayed')}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {analytics.funnelJourney.uniquePlayed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {t('admin.partnerAnalytics.uniqueRedeemed')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {analytics.funnelJourney.uniqueRedeemed}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {t('admin.partnerOrgRollup.funnelRates', {
                  enterToPlay: analytics.funnelJourney.enterToPlayPercent,
                  playToRedeem: analytics.funnelJourney.playToRedeemPercent,
                  enteredToRedeem: analytics.funnelJourney.enteredToRedeemPercent,
                })}
              </p>
            </div>
            <OwnerAttributionSnapshot attribution={analytics.attribution} />
            <OwnerAnalyticsCharts
              title={t('admin.partnerAnalytics.orgTrendsTitle')}
              visitsByDay={analytics.visits.byDay}
              redemptionsByDay={analytics.redemptions.byDay}
              byHour={hourSeries}
            />
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                {t('admin.partnerOrgRollup.topPerksTitle')}
              </h3>
              <PerkCountCards rows={perkRows} />
              <div className="hidden md:block text-sm border border-slate-200 rounded-lg overflow-hidden">
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
