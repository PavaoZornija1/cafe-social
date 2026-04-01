'use client';

import Link from 'next/link';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiBase } from '@/lib/api';
import { OwnerAnalyticsCharts } from '@/components/OwnerAnalyticsCharts';

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

export default function OwnerOrganizationPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { getToken, isLoaded } = useAuth();
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(
      `${apiBase()}/owner/organizations/${organizationId}/analytics?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as OrgAnalytics;
  }, [getToken, organizationId, days]);

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

  const hourSeries = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const exportCsv = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(
      `${apiBase()}/owner/organizations/${organizationId}/analytics/export.csv?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } },
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
    <div className="bg-zinc-950 text-zinc-100 min-h-full">
      <header className="border-b border-zinc-800 px-6 py-4 flex flex-wrap justify-between gap-3">
        <div>
          <Link href="/owner/venues" className="text-sm text-violet-400 hover:underline">
            ← Venues
          </Link>
          <h1 className="text-xl font-semibold mt-2">Franchise rollup</h1>
          <p className="text-sm text-zinc-400 mt-1 font-mono">{organizationId}</p>
        </div>
        <UserButton />
      </header>
      <main className="p-6 max-w-4xl">
        {!isLoaded || loading ? <p className="text-zinc-400">Loading…</p> : null}
        {error ? (
          <div className="rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        ) : null}
        {analytics && analytics.venueCount === 0 ? (
          <p className="text-zinc-400 mt-4">No venues are linked to this organization yet.</p>
        ) : null}
        {analytics && analytics.venueCount > 0 ? (
          <>
            <div className="flex flex-wrap gap-3 items-center mt-2">
              <label className="text-sm text-zinc-400">
                Period (days)
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
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
                onClick={() => void exportCsv()}
                className="text-sm text-emerald-400 hover:underline"
              >
                Export CSV (all locations)
              </button>
            </div>
            <p className="text-sm text-zinc-500 mt-4">
              Rolling up{' '}
              <span className="text-zinc-300 font-medium">{analytics.venueCount}</span> venues:{' '}
              {analytics.venues.map((v) => v.name).join(' · ')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-500">Unique players (org)</p>
                <p className="text-xl font-semibold text-zinc-100">{analytics.visits.uniquePlayers}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-500">Redemptions</p>
                <p className="text-xl font-semibold text-zinc-100">{analytics.redemptions.total}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-500">Visit → redeem %</p>
                <p className="text-xl font-semibold text-zinc-100">
                  {analytics.funnel.visitToRedeemPercent}%
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-500">Player-days (all sites)</p>
                <p className="text-xl font-semibold text-zinc-100">
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
              <h3 className="text-sm font-semibold text-zinc-300 mb-2">Top perks (all locations)</h3>
              <ul className="text-sm divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
                {analytics.redemptions.perPerk.slice(0, 12).map((p) => (
                  <li key={p.perkId} className="flex justify-between px-3 py-2 bg-zinc-900/40">
                    <span>
                      <span className="font-mono text-violet-300">{p.code}</span>{' '}
                      <span className="text-zinc-300">{p.title}</span>
                    </span>
                    <span className="text-zinc-400">{p.count}</span>
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
