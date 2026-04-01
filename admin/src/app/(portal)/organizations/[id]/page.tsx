'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { portalFetch } from '../../../../lib/portalApi';

type OrgDetail = {
  id: string;
  name: string;
  slug: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  stripeCustomerId: string | null;
  billingPortalUrl: string | null;
  venues: { id: string; name: string; locked: boolean; city: string | null; country: string | null }[];
};

export default function EditOrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [o, setO] = useState<OrgDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded || !id) return;
    let c = false;
    void (async () => {
      try {
        const data = await portalFetch<OrgDetail>(getToken, `/admin/organizations/${id}`, {
          method: 'GET',
        });
        if (!c) setO(data);
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, id, getToken]);

  const save = async () => {
    if (!o || !id) return;
    setSaving(true);
    setErr(null);
    try {
      await portalFetch(getToken, `/admin/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: o.name.trim(),
          slug: o.slug?.trim() || null,
          platformBillingPlan: o.platformBillingPlan?.trim() || null,
          platformBillingStatus: o.platformBillingStatus?.trim() || 'NONE',
          platformBillingRenewsAt: o.platformBillingRenewsAt || null,
          stripeCustomerId: o.stripeCustomerId?.trim() || null,
          billingPortalUrl: o.billingPortalUrl?.trim() || null,
        }),
      });
      router.push('/organizations');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (err && !o) {
    return (
      <div className="bg-zinc-950 text-red-300 p-8">
        {err}{' '}
        <Link href="/organizations" className="text-violet-400">
          Back
        </Link>
      </div>
    );
  }
  if (!o) {
    return <div className="bg-zinc-950 text-zinc-100 p-8">Loading…</div>;
  }

  const fld = (
    label: string,
    key: keyof Pick<
      OrgDetail,
      | 'name'
      | 'slug'
      | 'platformBillingPlan'
      | 'platformBillingStatus'
      | 'stripeCustomerId'
      | 'billingPortalUrl'
    >,
  ) => (
    <label className="block mb-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        value={(o[key] as string) ?? ''}
        onChange={(e) => setO({ ...o, [key]: e.target.value || null })}
      />
    </label>
  );

  return (
    <div className="bg-zinc-950 text-zinc-100 p-8 max-w-2xl">
      <Link href="/organizations" className="text-violet-400 text-sm hover:underline">
        ← Organizations
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">{o.name}</h1>
      <p className="text-xs text-zinc-500 font-mono mb-6">{o.id}</p>
      {fld('Name', 'name')}
      {fld('Slug (optional)', 'slug')}
      {fld('Platform billing plan label', 'platformBillingPlan')}
      {fld('Billing status (e.g. ACTIVE, PAST_DUE, NONE)', 'platformBillingStatus')}
      <label className="block mb-3">
        <span className="text-sm text-zinc-400">Renewal (ISO 8601, optional)</span>
        <input
          className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono"
          value={o.platformBillingRenewsAt ?? ''}
          onChange={(e) =>
            setO({
              ...o,
              platformBillingRenewsAt: e.target.value.trim() || null,
            })
          }
          placeholder="2026-04-01T12:00:00.000Z"
        />
      </label>
      {fld('Stripe customer id (optional)', 'stripeCustomerId')}
      {fld('Billing portal URL (optional)', 'billingPortalUrl')}
      <div className="mt-6 border border-zinc-800 rounded-lg p-3">
        <p className="text-sm font-medium text-zinc-300 mb-2">Linked venues</p>
        <ul className="text-sm text-zinc-400 space-y-1">
          {o.venues.length === 0 ? (
            <li>None — assign from venue edit.</li>
          ) : (
            o.venues.map((v) => (
              <li key={v.id}>
                <Link href={`/venues/${v.id}`} className="text-violet-400 hover:underline">
                  {v.name}
                </Link>
                {v.locked ? (
                  <span className="text-red-400 text-xs ml-2">locked</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      {err ? <p className="text-red-400 text-sm mt-3">{err}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-6 w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
