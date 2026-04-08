'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CitySelect } from '@/components/ui/CitySelect';
import { CountrySelect } from '@/components/ui/CountrySelect';
import {
  type AdminCreateVenueUnderOrgInput,
  useAdminCreateVenueUnderOrgMutation,
  useAdminOrganizationDeleteMutation,
  useAdminOrganizationDetailQuery,
  useAdminOrganizationPatchMutation,
  useAdminOrganizationVenuesLinkMutation,
  useAdminVenuesForOrgLinkQuery,
} from '@/lib/queries';
import type { GeofencePolygonGeoJson } from '@/components/VenueGeofenceMap';

const VenueGeofenceMap = dynamic(() => import('@/components/VenueGeofenceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[min(420px,55vh)] w-full rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

const DEFAULT_VENUE_PIN = { lat: 46.0569, lng: 14.5058 };

type OwnerContact = {
  playerId: string;
  email: string;
  username: string;
};

type OrgStats = {
  venueCount: number;
  lockedVenueCount: number;
  perksCount: number;
  totalRedemptions: number;
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string | null;
  /** Venue-level cap inherits this when venue override is unset */
  guestPlayDailyGamesLimit?: number | null;
  venues: {
    id: string;
    name: string;
    locked: boolean;
    city: string | null;
    country: string | null;
    address: string | null;
  }[];
  stats?: OrgStats;
  ownerContacts?: OwnerContact[];
  selfServeCreatedBy?: { id: string; email: string; username: string } | null;
};

type VenueListRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  organizationId: string | null;
};

const venueColHelper = createColumnHelper<VenueListRow>();

const fieldCol = 'flex min-w-0 flex-col gap-1.5';
const fieldLbl = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const fieldInp =
  'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 leading-none';

const emptyCreateVenue = () => ({
  name: '',
  pin: { ...DEFAULT_VENUE_PIN },
  geofencePolygon: null as GeofencePolygonGeoJson | null,
  address: '',
  city: '',
  country: '',
});

export default function EditOrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [o, setO] = useState<OrgDetail | null>(null);
  const [linkedVenueIds, setLinkedVenueIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateVenue);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [saveOrgOpen, setSaveOrgOpen] = useState(false);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<{ attach: string[]; detach: string[] } | null>(null);
  const [createConfirmPayload, setCreateConfirmPayload] =
    useState<AdminCreateVenueUnderOrgInput | null>(null);
  const [createConfirmErr, setCreateConfirmErr] = useState<string | null>(null);
  const [createMapKey, setCreateMapKey] = useState(0);

  const orgQ = useAdminOrganizationDetailQuery(id, getToken, Boolean(isLoaded && id));
  const venuesQ = useAdminVenuesForOrgLinkQuery(getToken, Boolean(isLoaded && id));
  const patchMut = useAdminOrganizationPatchMutation(id, getToken);
  const linkMut = useAdminOrganizationVenuesLinkMutation(id, getToken);
  const createVenueMut = useAdminCreateVenueUnderOrgMutation(id, getToken);
  const deleteMut = useAdminOrganizationDeleteMutation(id, getToken);

  useEffect(() => {
    setO(null);
    setErr(null);
    setSaveOrgOpen(false);
    setDeleteOrgOpen(false);
    setLinkModal(null);
    setCreateConfirmPayload(null);
    setCreateConfirmErr(null);
  }, [id]);

  useEffect(() => {
    if (!orgQ.data || !id) return;
    const next = orgQ.data as OrgDetail;
    setO((prev) => {
      if (prev && prev.id === next.id) {
        return {
          ...next,
          name: prev.name,
          slug: prev.slug,
          guestPlayDailyGamesLimit: prev.guestPlayDailyGamesLimit,
        };
      }
      return next;
    });
    setLinkedVenueIds(next.venues.map((v) => v.id));
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

  const venueNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of allVenues) m.set(v.id, v.name);
    if (o) for (const v of o.venues) m.set(v.id, v.name);
    return m;
  }, [allVenues, o]);

  const requestLinkVenuesModal = () => {
    if (!o || !id) return;
    const initial = new Set(o.venues.map((v) => v.id));
    const next = new Set(linkedVenueIds);
    const attach = linkedVenueIds.filter((vid) => !initial.has(vid));
    const detach = o.venues.map((v) => v.id).filter((vid) => !next.has(vid));
    if (attach.length === 0 && detach.length === 0) return;
    setLinkModal({ attach, detach });
  };

  const openCreateVenueConfirm = () => {
    setCreateErr(null);
    const { lat, lng } = createForm.pin;
    if (!createForm.name.trim()) {
      setCreateErr('Name is required.');
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCreateErr('Pin position is invalid.');
      return;
    }
    if (!createForm.geofencePolygon) {
      setCreateErr('Draw a geofence polygon on the map (toolbar: draw polygon).');
      return;
    }
    setCreateConfirmErr(null);
    setCreateConfirmPayload({
      name: createForm.name.trim(),
      latitude: lat,
      longitude: lng,
      geofencePolygon: createForm.geofencePolygon,
      ...(createForm.address.trim() && { address: createForm.address.trim() }),
      ...(createForm.city.trim() && { city: createForm.city.trim() }),
      ...(createForm.country.trim() && { country: createForm.country.trim() }),
    });
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

  const stats: OrgStats = o.stats ?? {
    venueCount: o.venues.length,
    lockedVenueCount: o.venues.filter((v) => v.locked).length,
    perksCount: 0,
    totalRedemptions: 0,
  };

  const ownerList = o.ownerContacts ?? [];

  return (
    <div className="bg-slate-50 text-slate-900 p-6 sm:p-8 max-w-5xl">
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

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Venues</p>
          <p className="text-lg font-semibold text-slate-900">{stats.venueCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Locked venues</p>
          <p className="text-lg font-semibold text-slate-900">{stats.lockedVenueCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Perks (all venues)</p>
          <p className="text-lg font-semibold text-slate-900">{stats.perksCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Redemptions</p>
          <p className="text-lg font-semibold text-slate-900">{stats.totalRedemptions}</p>
        </div>
      </div>

      <section className="mb-8 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">People</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Self-serve signup and venue owners across venues linked to this organization.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className={fieldCol}>
              <span className={fieldLbl}>Self-serve onboarding</span>
              {o.selfServeCreatedBy ? (
                <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900">
                  <p className="font-medium text-slate-900">{o.selfServeCreatedBy.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{o.selfServeCreatedBy.id}</p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-500">
                  No self-serve creator recorded for this org.
                </p>
              )}
            </div>

            <div className={fieldCol}>
              <span className={fieldLbl}>Venue owners (linked venues)</span>
              {ownerList.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-500">
                  No owner staff on these venues yet.
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm">
                  {ownerList.map((p) => (
                    <li key={p.playerId} className="border-b border-slate-200/80 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-slate-900">{p.email}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        ({p.username}) · <span className="font-mono text-slate-600">{p.playerId}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">Organization</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Display name, URL slug, and default guest play limit for venues without their own cap.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <label className={fieldCol} htmlFor="org-detail-name">
              <span className={fieldLbl}>Name</span>
              <input
                id="org-detail-name"
                className={fieldInp}
                value={o.name}
                onChange={(e) => setO({ ...o, name: e.target.value })}
                autoComplete="off"
              />
            </label>
            <label className={fieldCol} htmlFor="org-detail-slug">
              <span className={fieldLbl}>Slug (optional)</span>
              <input
                id="org-detail-slug"
                className={fieldInp}
                value={o.slug ?? ''}
                onChange={(e) => setO({ ...o, slug: e.target.value || null })}
                placeholder="url-friendly-id"
                autoComplete="off"
              />
            </label>
          </div>

          <label className={`${fieldCol} mt-4 max-w-md`} htmlFor="org-detail-guest-cap">
            <span className={fieldLbl}>Default guest daily game cap (optional)</span>
            <input
              id="org-detail-guest-cap"
              type="number"
              min={1}
              max={999}
              className={fieldInp}
              placeholder="Platform default"
              value={o.guestPlayDailyGamesLimit ?? ''}
              onChange={(e) => {
                const t = e.target.value;
                setO({
                  ...o,
                  guestPlayDailyGamesLimit: t === '' ? null : Number.parseInt(t, 10),
                });
              }}
            />
            <p className="text-xs leading-relaxed text-slate-500">
              Applies to linked venues that do not set their own cap (then env{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-700">
                VENUE_GUEST_PLAY_DAILY_GAMES
              </code>
              ).
            </p>
          </label>
        </div>
      </section>

      <div className="border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Venues</h2>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
              Create a new location for this organization, or link venues that already exist. If you
              link a venue that sits under another org, it will be moved here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateErr(null);
              setCreateOpen((wasOpen) => {
                const next = !wasOpen;
                if (next) {
                  setCreateForm(emptyCreateVenue());
                  setCreateMapKey((k) => k + 1);
                }
                return next;
              });
            }}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              createOpen
                ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                : 'border border-brand-active bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {createOpen ? 'Close form' : 'Create venue'}
          </button>
        </div>

        {createOpen ? (
          <section
            className="mx-4 mb-5 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 sm:mx-5"
            aria-labelledby="create-venue-heading"
          >
            <header className="border-b border-slate-200/80 bg-white px-4 py-4 sm:px-5">
              <h3 id="create-venue-heading" className="text-base font-semibold text-slate-900">
                New venue
              </h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-3xl">
                Enter a display name, then set the map pin and draw the play area. Guests only count
                as “in venue” when they are inside that polygon.
              </p>
            </header>

            <div className="space-y-6 px-4 py-5 sm:px-5">
              <div>
                <label className="block" htmlFor="org-create-venue-name">
                  <span className="text-sm font-medium text-slate-800">
                    Venue name <span className="text-red-600">*</span>
                  </span>
                  <input
                    id="org-create-venue-name"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="e.g. Northside · Main Street"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    autoComplete="off"
                  />
                </label>
              </div>

              <div key={createMapKey} className="space-y-3">
                <VenueGeofenceMap
                  pin={createForm.pin}
                  onPinChange={(p) => setCreateForm((f) => ({ ...f, pin: p }))}
                  onPolygonChange={(g) => setCreateForm((f) => ({ ...f, geofencePolygon: g }))}
                />
                <div
                  className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                    createForm.geofencePolygon
                      ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                      : 'border-amber-200 bg-amber-50/90 text-amber-950'
                  }`}
                  role="status"
                >
                  <span className="text-sm font-semibold">
                    {createForm.geofencePolygon ? 'Play area defined' : 'Play area not drawn yet'}
                  </span>
                  <span className="text-xs leading-snug opacity-90 sm:text-right sm:max-w-md">
                    {createForm.geofencePolygon
                      ? 'You can continue to adjust the shape, then use Create & link below.'
                      : 'Use Draw polygon in the map toolbar and close the ring so the pin sits inside.'}
                  </span>
                </div>
              </div>

              <fieldset className="rounded-xl border border-dashed border-slate-300/90 bg-white px-4 py-4 sm:px-5">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Address (optional)
                </legend>
                <p className="text-xs text-slate-500 mb-4 -mt-1">
                  Shown on venue listings; does not affect the geofence.
                </p>
                <div className="space-y-4">
                  <label className="block" htmlFor="org-create-venue-address">
                    <span className="text-sm font-medium text-slate-700">Street address</span>
                    <input
                      id="org-create-venue-address"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={createForm.address}
                      onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="org-create-venue-country"
                      >
                        Country
                      </label>
                      <CountrySelect
                        id="org-create-venue-country"
                        className="mt-1.5"
                        value={createForm.country}
                        onChange={(iso) =>
                          setCreateForm((f) => ({
                            ...f,
                            country: iso,
                            city: f.country !== iso ? '' : f.city,
                          }))
                        }
                        placeholder="Search country…"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Stored as ISO code (e.g. BA) for listings.
                      </p>
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="org-create-venue-city"
                      >
                        City
                      </label>
                      <CitySelect
                        id="org-create-venue-city"
                        className="mt-1.5"
                        countryCode={createForm.country}
                        cityName={createForm.city}
                        onChange={(name) => setCreateForm((f) => ({ ...f, city: name }))}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {createErr ? (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {createErr}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    setCreateErr(null);
                    setCreateOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createVenueMut.isPending}
                  onClick={() => openCreateVenueConfirm()}
                  className="rounded-lg border border-brand-active bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:opacity-50"
                >
                  Create &amp; link venue…
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="max-h-72 overflow-y-auto border-t border-slate-100 bg-white">
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
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <button
            type="button"
            disabled={linkMut.isPending || !linkDirty}
            onClick={() => requestLinkVenuesModal()}
            className="text-sm font-semibold rounded-lg bg-brand border border-brand-active text-white px-4 py-2.5 hover:bg-brand-hover disabled:opacity-40 disabled:hover:bg-brand"
          >
            Apply link changes…
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Tick venues above, then confirm to attach or detach them from this organization.
          </p>
        </div>
      </div>

      {err ? <p className="text-red-600 text-sm mt-3">{err}</p> : null}
      <button
        type="button"
        disabled={patchMut.isPending}
        onClick={() => setSaveOrgOpen(true)}
        className="mt-6 w-full bg-brand border border-brand-active text-white hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        Save organization…
      </button>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-sm font-semibold text-red-700 mb-2">Danger zone</h2>
        <button
          type="button"
          disabled={deleteMut.isPending}
          onClick={() => setDeleteOrgOpen(true)}
          className="text-sm bg-red-600 border border-red-700 text-white hover:bg-red-700 rounded-lg px-4 py-2 disabled:opacity-50"
        >
          Delete organization…
        </button>
      </div>

      <ConfirmModal
        open={saveOrgOpen}
        onClose={() => setSaveOrgOpen(false)}
        title="Save organization?"
        description={
          <>
            <p>
              Name <span className="font-medium text-slate-800">{o.name.trim() || '—'}</span>
              {o.slug?.trim() ? (
                <>
                  {', slug '}
                  <span className="font-mono text-slate-800">{o.slug.trim()}</span>
                </>
              ) : null}
            </p>
            <p>You will return to the organizations list after saving.</p>
          </>
        }
        confirmLabel="Save organization"
        onConfirm={async () => {
          if (!o || !id) return;
          setErr(null);
          const lim = o.guestPlayDailyGamesLimit;
          if (lim != null && (!Number.isFinite(lim) || lim < 1 || lim > 999)) {
            setErr('Guest daily game cap must be empty or an integer 1–999.');
            return;
          }
          try {
            await patchMut.mutateAsync({
              name: o.name.trim(),
              slug: o.slug?.trim() || null,
              guestPlayDailyGamesLimit: lim ?? null,
            });
            router.push('/organizations');
          } catch (e) {
            setErr((e as Error).message);
            throw e;
          }
        }}
      />

      <ConfirmModal
        open={deleteOrgOpen}
        onClose={() => setDeleteOrgOpen(false)}
        title="Delete this organization?"
        variant="danger"
        description={
          <>
            <p>
              <span className="font-semibold text-slate-900">“{o.name}”</span> will be removed.
              Venues stay in the system but are unlinked from this org. This cannot be undone.
            </p>
          </>
        }
        confirmLabel="Delete organization"
        onConfirm={async () => {
          if (!id || !o) return;
          setErr(null);
          try {
            await deleteMut.mutateAsync();
            router.push('/organizations');
          } catch (e) {
            setErr((e as Error).message);
            throw e;
          }
        }}
      />

      <ConfirmModal
        open={linkModal !== null}
        onClose={() => setLinkModal(null)}
        title="Update linked venues?"
        description={
          linkModal ? (
            <>
              <p className="text-slate-700">
                Confirm attaching and detaching venues for this organization. Venues linked from
                another org are moved here.
              </p>
              {linkModal.attach.some((vid) => {
                const row = allVenues.find((v) => v.id === vid);
                return Boolean(row?.organizationId && row.organizationId !== id);
              }) ? (
                <p className="text-amber-900 text-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  Some venues are currently tied to another organization and will be moved to this
                  one.
                </p>
              ) : null}
              {linkModal.attach.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-800">Link here ({linkModal.attach.length})</p>
                  <ul className="list-disc pl-5 text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {linkModal.attach.map((vid) => (
                      <li key={vid}>
                        {venueNameById.get(vid) ?? 'Venue'}{' '}
                        <span className="font-mono text-slate-500">{vid}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {linkModal.detach.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-800">
                    Unlink from this org ({linkModal.detach.length})
                  </p>
                  <ul className="list-disc pl-5 text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {linkModal.detach.map((vid) => (
                      <li key={vid}>
                        {venueNameById.get(vid) ?? 'Venue'}{' '}
                        <span className="font-mono text-slate-500">{vid}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null
        }
        confirmLabel="Apply changes"
        onConfirm={async () => {
          if (!linkModal || !o) return;
          setErr(null);
          try {
            await linkMut.mutateAsync({
              attachVenueIds: linkModal.attach,
              detachVenueIds: linkModal.detach,
            });
          } catch (e) {
            setErr((e as Error).message);
            throw e;
          }
        }}
      />

      <ConfirmModal
        open={createConfirmPayload !== null}
        onClose={() => {
          setCreateConfirmPayload(null);
          setCreateConfirmErr(null);
        }}
        title="Create venue under this organization?"
        description={
          createConfirmPayload ? (
            <div className="space-y-3 text-left">
              {createConfirmErr ? (
                <p className="text-sm text-red-800 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                  {createConfirmErr}
                </p>
              ) : null}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Venue name</p>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{createConfirmPayload.name}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 space-y-1">
                <p className="text-xs font-medium text-slate-500">Reference pin (WGS84)</p>
                <p className="font-mono text-xs sm:text-sm break-all">
                  {createConfirmPayload.latitude.toFixed(6)}, {createConfirmPayload.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-slate-600 pt-1">
                  Geofence:{' '}
                  <span className="font-medium text-slate-800">
                    {createConfirmPayload.geofencePolygon.coordinates[0]?.length ?? 0} positions
                  </span>{' '}
                  in outer ring (including closing point).
                </p>
              </div>
              {[createConfirmPayload.address, createConfirmPayload.city, createConfirmPayload.country]
                .filter(Boolean)
                .length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</p>
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">
                    {[
                      createConfirmPayload.address,
                      createConfirmPayload.city,
                      createConfirmPayload.country,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null
        }
        confirmLabel="Create venue"
        onConfirm={async () => {
          if (!createConfirmPayload) return;
          setCreateConfirmErr(null);
          try {
            await createVenueMut.mutateAsync(createConfirmPayload);
            setCreateForm(emptyCreateVenue());
            setCreateOpen(false);
          } catch (e) {
            setCreateConfirmErr((e as Error).message);
            throw e;
          }
        }}
      />
    </div>
  );
}
