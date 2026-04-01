'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '../../../lib/portalApi';

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  billingPortalUrl: string | null;
  _count?: { venues: number };
};

export default function OrganizationsPage() {
  const { isLoaded, getToken } = useAuth();
  const [rows, setRows] = useState<OrgRow[] | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await portalFetch<OrgRow[]>(getToken, '/admin/organizations', {
      method: 'GET',
    });
    setRows(data);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    let c = false;
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, refresh]);

  const createOrg = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await portalFetch(getToken, '/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setName('');
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 p-8 max-w-3xl">
      <div className="flex justify-between items-center gap-4 mb-6">
        <div>
          <Link href="/venues" className="text-violet-400 text-sm hover:underline">
            ← Venues CMS
          </Link>
          <h1 className="text-xl font-bold mt-2">Franchise organizations</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Link venues to an org for rolled-up owner analytics and billing metadata.
          </p>
        </div>
      </div>
      {err ? (
        <div className="mb-4 text-sm text-red-300 rounded-lg border border-red-900/80 bg-red-950/40 px-3 py-2">
          {err}
        </div>
      ) : null}
      <div className="border border-zinc-800 rounded-xl p-4 mb-8 flex flex-wrap gap-2 items-end">
        <label className="block flex-1 min-w-[200px] text-sm text-zinc-400">
          New organization name
          <input
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Northwind Cafés"
          />
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void createOrg()}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-medium h-[38px]"
        >
          Create
        </button>
      </div>
      {!rows ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <li
              key={o.id}
              className="border border-zinc-800 rounded-lg p-4 flex flex-wrap justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{o.name}</p>
                <p className="text-xs font-mono text-zinc-500 mt-1">{o.id}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  Venues: {o._count?.venues ?? 0} · Billing:{' '}
                  {o.platformBillingStatus}
                  {o.platformBillingPlan ? ` · ${o.platformBillingPlan}` : ''}
                </p>
              </div>
              <Link
                href={`/organizations/${o.id}`}
                className="text-sm text-violet-400 hover:underline self-start"
              >
                Edit billing →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
