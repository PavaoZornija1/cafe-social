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
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  PortalStatCard,
  portalButtonPrimaryClass,
  portalButtonSecondaryClass,
  portalInputClass,
  portalLabelClass,
} from '@/components/portal/PortalPageUi';
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
const fieldInp = `${portalInputClass} h-[42px] box-border py-0 leading-none`;

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
  const { t } = useTranslation();
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
            aria-label={t('admin.organizationDetail.linkAria', { name: row.original.name })}
          />
        ),
      }),
      venueColHelper.accessor('name', {
        header: t('admin.organizationDetail.colVenue'),
        cell: (c) => (
          <span className="text-sm text-slate-800">
            {c.getValue()}
            <span className="text-slate-500 text-xs block font-mono">{c.row.original.id}</span>
          </span>
        ),
      }),
      venueColHelper.display({
        id: 'loc',
        header: t('admin.organizationDetail.colLocation'),
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
            <span className="text-amber-800 text-xs">{t('admin.venueCms.common.otherOrg')}</span>
          ) : null,
      }),
    ],
    [linkedVenueIds, id, toggleVenue, t],
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
      <PortalPageLayout maxWidth="5xl">
        <PortalAlert tone="error">
          {(loadErr ?? err ?? 'Error')}{' '}
          <Link href="/organizations" className="font-medium text-brand hover:text-brand-hover">
            {t('admin.organizationDetail.back')}
          </Link>
        </PortalAlert>
      </PortalPageLayout>
    );
  }
  if (!o) {
    return (
      <PortalPageLayout maxWidth="5xl">
        <PortalSkeleton rows={3} />
      </PortalPageLayout>
    );
  }

  const stats: OrgStats = o.stats ?? {
    venueCount: o.venues.length,
    lockedVenueCount: o.venues.filter((v) => v.locked).length,
    perksCount: 0,
    totalRedemptions: 0,
  };

  const ownerList = o.ownerContacts ?? [];

  return (
    <PortalPageLayout maxWidth="5xl">
      <PortalPageHeader
        backHref="/organizations"
        backLabel={t('admin.organizationDetail.allOrganizations')}
        title={o.name}
        meta={<p className="font-mono text-xs text-slate-500">{o.id}</p>}
      >
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/platform" className="font-medium text-brand hover:text-brand-hover">
            {t('admin.organizationDetail.backPlatform')}
          </Link>
        </div>
      </PortalPageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PortalStatCard label={t('admin.organizationDetail.statVenues')} value={stats.venueCount} />
        <PortalStatCard label={t('admin.organizationDetail.statLockedVenues')} value={stats.lockedVenueCount} />
        <PortalStatCard label={t('admin.organizationDetail.statPerks')} value={stats.perksCount} />
        <PortalStatCard label={t('admin.organizationDetail.statRedemptions')} value={stats.totalRedemptions} />
      </div>

      <PortalCard className="mb-8 space-y-6">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('admin.organizationDetail.peopleTitle')}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              {t('admin.organizationDetail.peopleLead')}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className={fieldCol}>
              <span className={portalLabelClass}>{t('admin.organizationDetail.selfServeLabel')}</span>
              {o.selfServeCreatedBy ? (
                <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900">
                  <p className="font-medium text-slate-900">{o.selfServeCreatedBy.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{o.selfServeCreatedBy.id}</p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-500">
                  {t('admin.organizationDetail.selfServeEmpty')}
                </p>
              )}
            </div>

            <div className={fieldCol}>
              <span className={portalLabelClass}>{t('admin.organizationDetail.ownersLabel')}</span>
              {ownerList.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-500">
                  {t('admin.organizationDetail.ownersEmpty')}
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
          <h2 className="text-sm font-semibold text-slate-900">{t('admin.organizationDetail.orgSectionTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            {t('admin.organizationDetail.orgSectionLead')}
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <label className={fieldCol} htmlFor="org-detail-name">
              <span className={portalLabelClass}>{t('admin.organizationDetail.nameLabel')}</span>
              <input
                id="org-detail-name"
                className={fieldInp}
                value={o.name}
                onChange={(e) => setO({ ...o, name: e.target.value })}
                autoComplete="off"
              />
            </label>
            <label className={fieldCol} htmlFor="org-detail-slug">
              <span className={portalLabelClass}>{t('admin.organizationDetail.slugOptional')}</span>
              <input
                id="org-detail-slug"
                className={fieldInp}
                value={o.slug ?? ''}
                onChange={(e) => setO({ ...o, slug: e.target.value || null })}
                placeholder={t('admin.organizationDetail.slugPlaceholder')}
                autoComplete="off"
              />
            </label>
          </div>

          <label className={`${fieldCol} mt-4 max-w-md`} htmlFor="org-detail-guest-cap">
            <span className={portalLabelClass}>{t('admin.organizationDetail.guestCapOptional')}</span>
            <input
              id="org-detail-guest-cap"
              type="number"
              min={1}
              max={999}
              className={fieldInp}
              placeholder={t('admin.organizationDetail.guestCapPlaceholder')}
              value={o.guestPlayDailyGamesLimit ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                setO({
                  ...o,
                  guestPlayDailyGamesLimit: raw === '' ? null : Number.parseInt(raw, 10),
                });
              }}
            />
            <p className="text-xs leading-relaxed text-slate-500">
              {t('admin.organizationDetail.guestCapHint')}{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-700">
                VENUE_GUEST_PLAY_DAILY_GAMES
              </code>
              ).
            </p>
          </label>
        </div>
      </PortalCard>

      <PortalCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{t('admin.organizationDetail.venuesTitle')}</h2>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
              {t('admin.organizationDetail.venuesLead')}
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
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              createOpen
                ? portalButtonSecondaryClass
                : portalButtonPrimaryClass
            }`}
          >
            {createOpen ? t('admin.organizationDetail.closeForm') : t('admin.organizationDetail.createVenueButton')}
          </button>
        </div>

        {createOpen ? (
          <section
            className="mx-4 mb-5 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 sm:mx-5"
            aria-labelledby="create-venue-heading"
          >
            <header className="border-b border-slate-200/80 bg-white px-4 py-4 sm:px-5">
              <h3 id="create-venue-heading" className="text-base font-semibold text-slate-900">
                {t('admin.organizationDetail.newVenueTitle')}
              </h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-3xl">
                {t('admin.organizationDetail.newVenueLead')}
              </p>
            </header>

            <div className="space-y-6 px-4 py-5 sm:px-5">
              <div>
                <label className="block" htmlFor="org-create-venue-name">
                  <span className="text-sm font-medium text-slate-800">
                    {t('admin.organizationDetail.venueNameRequired')} <span className="text-red-600">*</span>
                  </span>
                  <input
                    id="org-create-venue-name"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder={t('admin.organizationDetail.venueNamePlaceholder')}
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
                  searchCountryBias={createForm.country || undefined}
                  onAddressResolved={(fields) => {
                    setCreateForm((f) => ({
                      ...f,
                      ...(fields.address ? { address: fields.address } : {}),
                      ...(fields.city ? { city: fields.city } : {}),
                      ...(fields.country ? { country: fields.country } : {}),
                    }));
                  }}
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
                    {createForm.geofencePolygon
                      ? t('admin.organizationDetail.playAreaDefined')
                      : t('admin.organizationDetail.playAreaNotDrawn')}
                  </span>
                  <span className="text-xs leading-snug opacity-90 sm:text-right sm:max-w-md">
                    {createForm.geofencePolygon
                      ? t('admin.organizationDetail.playAreaDefinedHint')
                      : t('admin.organizationDetail.playAreaNotDrawnHint')}
                  </span>
                </div>
              </div>

              <fieldset className="rounded-xl border border-dashed border-slate-300/90 bg-white px-4 py-4 sm:px-5">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('admin.organizationDetail.addressOptional')}
                </legend>
                <p className="text-xs text-slate-500 mb-4 -mt-1">
                  {t('admin.organizationDetail.addressLegendHint')}
                </p>
                <div className="space-y-4">
                  <label className="block" htmlFor="org-create-venue-address">
                    <span className="text-sm font-medium text-slate-700">{t('admin.organizationDetail.streetAddress')}</span>
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
                        {t('admin.organizationDetail.countryLabel')}
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
                        placeholder={t('admin.organizationDetail.searchCountryPlaceholder')}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {t('admin.organizationDetail.countryHint')}
                      </p>
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="org-create-venue-city"
                      >
                        {t('admin.organizationDetail.cityLabel')}
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
                  {t('admin.organizationDetail.cancel')}
                </button>
                <button
                  type="button"
                  disabled={createVenueMut.isPending}
                  onClick={() => openCreateVenueConfirm()}
                  className="rounded-lg border border-brand-active bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:opacity-50"
                >
                  {t('admin.organizationDetail.createAndLink')}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="max-h-72 overflow-y-auto border-t border-slate-100 bg-white">
          <ul className="md:hidden divide-y divide-slate-100">
            {sortedVenues.map((v) => (
              <li key={v.id} className="flex gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={linkedVenueIds.includes(v.id)}
                  onChange={() => toggleVenue(v.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                  aria-label={t('admin.organizationDetail.linkAria', { name: v.name })}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{v.name}</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{v.id}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {[v.city, v.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {v.organizationId && v.organizationId !== id ? (
                    <p className="text-xs text-amber-800 mt-1">{t("admin.venueCms.common.otherOrg")}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <table className="min-w-full text-sm">
            <thead>
              {venueTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200 bg-brand-lighter/40">
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
                <tr key={row.id} className="border-b border-slate-100 transition-colors hover:bg-brand-lighter/30">
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
        </div>
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <button
            type="button"
            disabled={linkMut.isPending || !linkDirty}
            onClick={() => requestLinkVenuesModal()}
            className={portalButtonPrimaryClass}
          >
            {t('admin.organizationDetail.applyLinkChanges')}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {t('admin.organizationDetail.applyLinkHint')}
          </p>
        </div>
      </PortalCard>

      {err ? <PortalAlert tone="error" className="mt-4">{err}</PortalAlert> : null}
      <button
        type="button"
        disabled={patchMut.isPending}
        onClick={() => setSaveOrgOpen(true)}
        className={`mt-6 w-full ${portalButtonPrimaryClass}`}
      >
        {t('admin.organizationDetail.saveOrganization')}
      </button>

      <PortalCard className="mt-10 border-red-200/60 bg-gradient-to-br from-red-50/40 to-white">
        <h2 className="mb-3 text-sm font-semibold text-red-700">{t('admin.organizationDetail.dangerZone')}</h2>
        <button
          type="button"
          disabled={deleteMut.isPending}
          onClick={() => setDeleteOrgOpen(true)}
          className="rounded-xl border border-red-700 bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {t('admin.organizationDetail.deleteOrganization')}
        </button>
      </PortalCard>

      <ConfirmModal
        open={saveOrgOpen}
        onClose={() => setSaveOrgOpen(false)}
        title={t('admin.organizationDetail.saveConfirmTitle')}
        description={
          <>
            <p>
              {t('admin.organizationDetail.saveConfirmName', { name: o.name.trim() || '—' })}
              {o.slug?.trim() ? (
                <>
                  {t('admin.organizationDetail.saveConfirmSlug', { slug: o.slug.trim() })}
                </>
              ) : null}
            </p>
            <p>{t('admin.organizationDetail.saveConfirmReturn')}</p>
          </>
        }
        confirmLabel={t('admin.organizationDetail.saveConfirmLabel')}
        onConfirm={async () => {
          if (!o || !id) return;
          setErr(null);
          const lim = o.guestPlayDailyGamesLimit;
          if (lim != null && (!Number.isFinite(lim) || lim < 1 || lim > 999)) {
            setErr(t('admin.organizationDetail.errGuestCap'));
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
        title={t('admin.organizationDetail.deleteConfirmTitle')}
        variant="danger"
        description={
          <>
            <p>
              {t('admin.organizationDetail.deleteConfirmBody', { name: o.name })}
            </p>
          </>
        }
        confirmLabel={t('admin.organizationDetail.deleteConfirmLabel')}
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
        title={t('admin.organizationDetail.linkConfirmTitle')}
        description={
          linkModal ? (
            <>
              <p className="text-slate-700">
                {t('admin.organizationDetail.linkConfirmLead')}
              </p>
              {linkModal.attach.some((vid) => {
                const row = allVenues.find((v) => v.id === vid);
                return Boolean(row?.organizationId && row.organizationId !== id);
              }) ? (
                <p className="text-amber-900 text-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  {t('admin.organizationDetail.linkConfirmMoveWarning')}
                </p>
              ) : null}
              {linkModal.attach.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-800">
                    {t('admin.organizationDetail.linkConfirmAttach', { count: linkModal.attach.length })}
                  </p>
                  <ul className="list-disc pl-5 text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {linkModal.attach.map((vid) => (
                      <li key={vid}>
                        {venueNameById.get(vid) ?? t('admin.organizationDetail.venueFallback')}{' '}
                        <span className="font-mono text-slate-500">{vid}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {linkModal.detach.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-800">
                    {t('admin.organizationDetail.linkConfirmDetach', { count: linkModal.detach.length })}
                  </p>
                  <ul className="list-disc pl-5 text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {linkModal.detach.map((vid) => (
                      <li key={vid}>
                        {venueNameById.get(vid) ?? t('admin.organizationDetail.venueFallback')}{' '}
                        <span className="font-mono text-slate-500">{vid}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null
        }
        confirmLabel={t('admin.organizationDetail.linkConfirmLabel')}
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
        title={t('admin.organizationDetail.createConfirmTitle')}
        description={
          createConfirmPayload ? (
            <div className="space-y-3 text-left">
              {createConfirmErr ? (
                <p className="text-sm text-red-800 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                  {createConfirmErr}
                </p>
              ) : null}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('admin.organizationDetail.createConfirmVenueName')}
                </p>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{createConfirmPayload.name}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 space-y-1">
                <p className="text-xs font-medium text-slate-500">{t('admin.organizationDetail.createConfirmPin')}</p>
                <p className="font-mono text-xs sm:text-sm break-all">
                  {createConfirmPayload.latitude.toFixed(6)}, {createConfirmPayload.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-slate-600 pt-1">
                  {t('admin.organizationDetail.createConfirmGeofence', {
                    count: createConfirmPayload.geofencePolygon.coordinates[0]?.length ?? 0,
                  })}
                </p>
              </div>
              {[createConfirmPayload.address, createConfirmPayload.city, createConfirmPayload.country]
                .filter(Boolean)
                .length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t('admin.organizationDetail.createConfirmAddress')}
                  </p>
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
        confirmLabel={t('admin.organizationDetail.createConfirmLabel')}
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
    </PortalPageLayout>
  );
}
