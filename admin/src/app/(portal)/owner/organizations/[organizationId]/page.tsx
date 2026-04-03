'use client';

import Link from 'next/link';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ownerFetch } from '@/lib/portalApi';
import { OwnerAnalyticsCharts } from '@/components/OwnerAnalyticsCharts';
import { PartnerReadOnlyBanner } from '@/components/PartnerReadOnlyBanner';
import {
  partnerOrganizationMutationsBlockedReason,
  partnerVenueMutationsBlockedReason,
} from '@/lib/partnerVenueReadOnly';

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

export default function OwnerOrganizationPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { getToken, isLoaded } = useAuth();
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgReadOnlyMessage, setOrgReadOnlyMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Not signed in');
    const res = await ownerFetch(
      getToken,
      `/owner/organizations/${organizationId}/analytics?days=${days}`,
      { method: 'GET' },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as OrgAnalytics;
  }, [getToken, organizationId, days]);

  const loadPortalVenuesMeta = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(getToken, '/owner/venues', { method: 'GET' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      platformRole?: string;
      venues: PortalVenueListRow[];
      actingPartnerVenueId?: string | null;
    };
    const platformRole = data.platformRole ?? 'NONE';
    const actingId = data.actingPartnerVenueId ?? null;
    const rows = data.venues.filter(
      (r) => r.venue.organizationId === organizationId,
    );
    if (platformRole === 'SUPER_ADMIN' && !actingId) {
      setOrgReadOnlyMessage(null);
      return;
    }
    const org = rows[0]?.venue.organization ?? null;
    const orgMsg = partnerOrganizationMutationsBlockedReason(org);
    if (orgMsg) {
      setOrgReadOnlyMessage(orgMsg);
      return;
    }
    const venueMsg = rows
      .map((r) =>
        partnerVenueMutationsBlockedReason({
          locked: r.venue.locked,
          lockReason: r.venue.lockReason ?? null,
          organization: r.venue.organization ?? org,
        }),
      )
      .find((m) => m != null);
    setOrgReadOnlyMessage(venueMsg ?? null);
  }, [getToken, organizationId]);

  useEffect(() => {
    if (!isLoaded || !organizationId) return;
    let c = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await load();
        if (!c) setAnalytics(data);
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, organizationId, load]);

  useEffect(() => {
    if (!isLoaded || !organizationId) return;
    void loadPortalVenuesMeta();
  }, [isLoaded, organizationId, loadPortalVenuesMeta]);

  const hourSeries = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const readOnlyDisabled = Boolean(orgReadOnlyMessage);

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
        {!isLoaded || loading ? <p className="text-slate-600">Loading…</p> : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
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
              <ul className="text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {analytics.redemptions.perPerk.slice(0, 12).map((p) => (
                  <li key={p.perkId} className="flex justify-between px-3 py-2 bg-slate-50">
                    <span>
                      <span className="font-mono text-brand">{p.code}</span>{' '}
                      <span className="text-slate-800">{p.title}</span>
                    </span>
                    <span className="text-slate-600">{p.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
