'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { portalFetch } from '@/lib/portalApi';
import {
  useAdminOrganizationDeleteMutation,
  useAdminOrganizationDetailQuery,
  useAdminOrganizationPatchMutation,
  useAdminOrganizationVenuesLinkMutation,
  useAdminVenuesForOrgLinkQuery,
} from '@/lib/queries';

type OrgDetail = {
  id: string;
  name: string;
  slug: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  platformBillingSyncedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingPortalUrl: string | null;
  venues: {
    id: string;
    name: string;
    locked: boolean;
    city: string | null;
    country: string | null;
    address: string | null;
  }[];
};

type VenueListRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  organizationId: string | null;
};

const venueColHelper = createColumnHelper<VenueListRow>();

export default function EditOrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, getToken } = useAuth();
  const [o, setO] = useState<OrgDetail | null>(null);
  const [linkedVenueIds, setLinkedVenueIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeErr, setStripeErr] = useState<string | null>(null);
  const seededForOrgId = useRef<string | null>(null);

  const orgQ = useAdminOrganizationDetailQuery(id, getToken, Boolean(isLoaded && id));
  const venuesQ = useAdminVenuesForOrgLinkQuery(getToken, Boolean(isLoaded && id));
  const patchMut = useAdminOrganizationPatchMutation(id, getToken);
  const linkMut = useAdminOrganizationVenuesLinkMutation(id, getToken);
  const deleteMut = useAdminOrganizationDeleteMutation(id, getToken);

  useEffect(() => {
    if (!orgQ.data || !id) return;
    if (seededForOrgId.current !== id) {
      seededForOrgId.current = id;
      setO(orgQ.data as OrgDetail);
      setLinkedVenueIds((orgQ.data as OrgDetail).venues.map((v) => v.id));
    }
  }, [id, orgQ.data]);

  const allVenues: VenueListRow[] = useMemo(
    () =>
      (venuesQ.data ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        city: v.city ?? null,
        country: v.country ?? null,
        organizationId: v.organizationId ?? null,
      })),
    [venuesQ.data],
  );

  const formatDt = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  const billingStatusNote = (status: string) => {
    switch (status) {
      case 'ACTIVE_CANCELING':
        return 'Paid access until the renewal / period-end date; subscription will not renew.';
      case 'CANCELED':
        return 'Franchise SaaS subscription ended. Restore access via Checkout or support.';
      case 'PAST_DUE':
      case 'UNPAID':
        return 'Payment problem — owner should update billing in Stripe or you intervene.';
      case 'ACTIVE':
      case 'TRIALING':
        return 'In good standing for franchise billing.';
      default:
        return null;
    }
  };

  const sortedVenues = useMemo(
    () => [...allVenues].sort((a, b) => a.name.localeCompare(b.name)),
    [allVenues],
  );

  const toggleVenue = useCallback((vid: string) => {
    setLinkedVenueIds((prev) =>
      prev.includes(vid) ? prev.filter((x) => x !== vid) : [...prev, vid],
    );
  }, []);

  const venueColumns = useMemo(
    () => [
      venueColHelper.display({
        id: 'link',
        header: '',
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={linkedVenueIds.includes(row.original.id)}
            onChange={() => toggleVenue(row.original.id)}
            className="mt-1"
            aria-label={`Link ${row.original.name}`}
          />
        ),
      }),
      venueColHelper.accessor('name', {
        header: 'Venue',
        cell: (c) => (
          <span className="text-sm text-slate-800">
            {c.getValue()}
            <span className="text-slate-500 text-xs block font-mono">{c.row.original.id}</span>
          </span>
        ),
      }),
      venueColHelper.display({
        id: 'loc',
        header: 'Location',
        cell: ({ row }) => (
          <span className="text-slate-500 text-xs">
            {[row.original.city, row.original.country].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      }),
      venueColHelper.display({
        id: 'orgmove',
        header: '',
        cell: ({ row }) =>
          row.original.organizationId && row.original.organizationId !== id ? (
            <span className="text-amber-800 text-xs">Other org</span>
          ) : null,
      }),
    ],
    [linkedVenueIds, id, toggleVenue],
  );

  const venueTable = useReactTable({
    data: sortedVenues,
    columns: venueColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const linkDirty = useMemo(() => {
    if (!o) return false;
    const a = new Set(o.venues.map((v) => v.id));
    const b = new Set(linkedVenueIds);
    if (a.size !== b.size) return true;
    for (const x of a) if (!b.has(x)) return true;
    return false;
  }, [o, linkedVenueIds]);

  const saveVenueLinks = async () => {
    if (!o || !id) return;
    const initial = new Set(o.venues.map((v) => v.id));
    const next = new Set(linkedVenueIds);
    const attach = linkedVenueIds.filter((vid) => !initial.has(vid));
    const detach = o.venues.map((v) => v.id).filter((vid) => !next.has(vid));
    if (attach.length === 0 && detach.length === 0) return;
    setErr(null);
    try {
      const updated = (await linkMut.mutateAsync({
        attachVenueIds: attach,
        detachVenueIds: detach,
      })) as OrgDetail;
      setO(updated);
      setLinkedVenueIds(updated.venues.map((v) => v.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const save = async () => {
    if (!o || !id) return;
    setErr(null);
    try {
      await patchMut.mutateAsync({
        name: o.name.trim(),
        slug: o.slug?.trim() || null,
        platformBillingPlan: o.platformBillingPlan?.trim() || null,
        platformBillingStatus: o.platformBillingStatus?.trim() || 'NONE',
        platformBillingRenewsAt: o.platformBillingRenewsAt || null,
        stripeCustomerId: o.stripeCustomerId?.trim() || null,
        billingPortalUrl: o.billingPortalUrl?.trim() || null,
      });
      router.push('/organizations');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const startStripeCheckout = async () => {
    if (!id) return;
    setStripeBusy(true);
    setStripeErr(null);
    setErr(null);
    try {
      const r = await portalFetch<{ url: string }>(
        getToken,
        `/admin/organizations/${id}/stripe/checkout-session`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      window.location.href = r.url;
    } catch (e) {
      setStripeErr((e as Error).message);
    } finally {
      setStripeBusy(false);
    }
  };

  const openStripePortal = async () => {
    if (!id) return;
    setStripeBusy(true);
    setStripeErr(null);
    setErr(null);
    try {
      const r = await portalFetch<{ url: string }>(
        getToken,
        `/admin/organizations/${id}/stripe/billing-portal`,
        { method: 'POST', body: '{}' },
      );
      window.location.href = r.url;
    } catch (e) {
      setStripeErr((e as Error).message);
    } finally {
      setStripeBusy(false);
    }
  };

  const deleteOrg = async () => {
    if (!id || !o) return;
    if (
      !window.confirm(
        `Delete organization “${o.name}”? Venues stay in the system but are unlinked from this org. This cannot be undone.`,
      )
    ) {
      return;
    }
    setErr(null);
    try {
      await deleteMut.mutateAsync();
      router.push('/organizations');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const loadErr =
    orgQ.isError && orgQ.error instanceof Error
      ? orgQ.error.message
      : venuesQ.isError && venuesQ.error instanceof Error
        ? venuesQ.error.message
        : null;

  if ((loadErr || err) && !o) {
    return (
      <div className="bg-slate-50 text-red-700 p-8">
        {(loadErr ?? err ?? 'Error')}{' '}
        <Link href="/organizations" className="text-brand">
          Back
        </Link>
      </div>
    );
  }
  if (!o) {
    return <div className="bg-slate-50 text-slate-900 p-8">Loading…</div>;
  }

  const billingNote = billingStatusNote(o.platformBillingStatus);

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
      <span className="text-sm text-slate-600">{label}</span>
      <input
        className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
        value={(o[key] as string) ?? ''}
        onChange={(e) => setO({ ...o, [key]: e.target.value || null })}
      />
    </label>
  );

  return (
    <div className="bg-slate-50 text-slate-900 p-8 max-w-3xl">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/platform" className="text-brand hover:underline">
          ← Platform
        </Link>
        <Link href="/organizations" className="text-brand hover:underline">
          All organizations
        </Link>
      </div>
      <h1 className="text-xl font-bold mt-4 mb-1">{o.name}</h1>
      <p className="text-xs text-slate-500 font-mono mb-6">{o.id}</p>
      {searchParams.get('billing') === 'success' ? (
        <p className="mb-4 text-sm text-emerald-900 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          Stripe Checkout completed. Webhooks will sync status shortly — refresh if fields look stale.
        </p>
      ) : null}
      {searchParams.get('billing') === 'cancel' ? (
        <p className="mb-4 text-sm text-slate-600 rounded-lg border border-slate-200 px-3 py-2">
          Checkout canceled.
        </p>
      ) : null}

      <div className="mb-6 border border-slate-200 rounded-xl p-4 space-y-2 bg-brand-light/60">
        <h2 className="text-sm font-semibold text-slate-800">Franchise billing (Stripe-synced)</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Status</dt>
            <dd className="font-mono text-slate-800">{o.platformBillingStatus}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Renewal / current period end</dt>
            <dd className="text-slate-800">{formatDt(o.platformBillingRenewsAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Last webhook update</dt>
            <dd className="text-slate-800">{formatDt(o.platformBillingSyncedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Stripe subscription id</dt>
            <dd className="font-mono text-xs text-slate-600 break-all">
              {o.stripeSubscriptionId ?? '—'}
            </dd>
          </div>
        </dl>
        {billingNote ? (
          <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">
            {billingNote}
          </p>
        ) : null}
      </div>

      {fld('Name', 'name')}
      {fld('Slug (optional)', 'slug')}
      {fld('Platform billing plan label', 'platformBillingPlan')}
      {fld(
        'Billing status (Stripe sets ACTIVE, ACTIVE_CANCELING, CANCELED, …; manual NONE)',
        'platformBillingStatus',
      )}
      <label className="block mb-3">
        <span className="text-sm text-slate-600">Renewal (ISO 8601, optional)</span>
        <input
          className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
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

      <div className="mt-4 border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Stripe — franchise billing</h2>
        <p className="text-xs text-slate-500">
          In-app <strong className="text-slate-600">player</strong> plans use RevenueCat. Use Stripe here
          for <strong className="text-slate-600">venue / org</strong> platform fees. Configure{' '}
          <code className="text-slate-600">STRIPE_SECRET_KEY</code>, webhook endpoint{' '}
          <code className="text-slate-600">/api/webhooks/stripe</code>, and{' '}
          <code className="text-slate-600">STRIPE_PARTNER_PRICE_ID</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={stripeBusy}
            onClick={() => void startStripeCheckout()}
            className="text-sm bg-brand border border-brand-active text-white rounded-lg px-4 py-2 hover:bg-brand-hover disabled:opacity-50"
          >
            {stripeBusy ? 'Redirecting…' : 'Start subscription (Checkout)'}
          </button>
          <button
            type="button"
            disabled={stripeBusy || !o.stripeCustomerId}
            onClick={() => void openStripePortal()}
            className="text-sm bg-slate-200 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-300 disabled:opacity-40"
          >
            Stripe customer portal
          </button>
        </div>
        {stripeErr ? (
          <p className="text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            {stripeErr}
          </p>
        ) : null}
      </div>

      <div className="mt-8 border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Venues in this franchise</h2>
        <p className="text-xs text-slate-500 mb-3">
          Check venues to attach; uncheck to detach. Assigning a venue that belongs to another org
          moves it here (super admin).
        </p>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              {venueTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="text-left px-3 py-2 text-xs uppercase text-slate-500 font-normal"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {venueTable.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          disabled={linkMut.isPending || !linkDirty}
          onClick={() => void saveVenueLinks()}
          className="mt-3 text-sm bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2"
        >
          {linkMut.isPending ? 'Saving links…' : 'Apply venue links'}
        </button>
      </div>

      {err ? <p className="text-red-600 text-sm mt-3">{err}</p> : null}
      <button
        type="button"
        disabled={patchMut.isPending}
        onClick={() => void save()}
        className="mt-6 w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        {patchMut.isPending ? 'Saving…' : 'Save organization'}
      </button>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-sm font-semibold text-red-700 mb-2">Danger zone</h2>
        <button
          type="button"
          disabled={deleteMut.isPending}
          onClick={() => void deleteOrg()}
          className="text-sm bg-red-600 border border-red-700 text-white hover:bg-red-700 rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {deleteMut.isPending ? 'Deleting…' : 'Delete organization'}
        </button>
      </div>
    </div>
  );
}
