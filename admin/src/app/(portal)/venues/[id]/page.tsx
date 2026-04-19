"use client";

import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import dynamic from "next/dynamic";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { ConfirmModal } from "@/components/ConfirmModal";
import { OrganizationAsyncSelect } from "@/components/ui/OrganizationAsyncSelect";
import { VenueChallengesSection } from "@/components/venue-cms/VenueChallengesSection";
import { VenueOffersSection } from "@/components/venue-cms/VenueOffersSection";
import { VenueNudgeSection } from "@/components/venue-cms/VenueNudgeSection";
import { VenuePerksSection } from "@/components/venue-cms/VenuePerksSection";
import {
  type AdminVenueDetail,
  type AdminVenueTypeRow,
  type AdminVenueStaffRow,
  useAdminVenueDetailQuery,
  useAdminVenuePatchMutation,
  useAdminVenueTypeCatalogQuery,
  useAdminVenueTypeCreateMutation,
  useAdminVenueStaffQuery,
  useAdminVenueStaffRemoveMutation,
  useAdminVenueStaffUpsertMutation,
  usePortalMeQuery,
} from "@/lib/queries";

const VenueGeofenceMap = dynamic(() => import("@/components/VenueGeofenceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(420px,55vh)] w-full rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

function adminVenueGeofenceToGeoJson(raw: unknown): GeofencePolygonGeoJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { type?: unknown; coordinates?: unknown };
  if (o.type !== "Polygon" || !Array.isArray(o.coordinates)) return null;
  return { type: "Polygon", coordinates: o.coordinates as number[][][] };
}

type VenueEditForm = {
  menuUrl: string;
  orderingUrl: string;
  venueTypeCodes: string[];
  orderNudgeTitle: string;
  orderNudgeBody: string;
  analyticsTimeZone: string;
  organizationId: string;
  locked: boolean;
  lockReason: string;
  /** Empty string = inherit from organization / platform default */
  guestPlayDailyGamesLimit: string;
  requiresExplicitCheckIn: boolean;
};

const staffColHelper = createColumnHelper<AdminVenueStaffRow>();

/** Same 42px control height as venue CMS selects (native select ignores vertical padding). */
const staffFieldText =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 leading-none";
const staffFieldSelect =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 pr-9 leading-none";

function venueToForm(v: AdminVenueDetail): VenueEditForm {
  return {
    menuUrl: v.menuUrl ?? "",
    orderingUrl: v.orderingUrl ?? "",
    venueTypeCodes: v.venueTypes?.map((t) => t.code) ?? [],
    orderNudgeTitle: v.orderNudgeTitle ?? "",
    orderNudgeBody: v.orderNudgeBody ?? "",
    analyticsTimeZone: v.analyticsTimeZone ?? "",
    organizationId: v.organizationId ?? "",
    locked: v.locked ?? false,
    lockReason: v.lockReason ?? "",
    guestPlayDailyGamesLimit:
      v.guestPlayDailyGamesLimit != null ? String(v.guestPlayDailyGamesLimit) : "",
    requiresExplicitCheckIn: v.requiresExplicitCheckIn ?? false,
  };
}

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [pageErr, setPageErr] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<AdminVenueStaffRow["role"]>("EMPLOYEE");
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [staffRemoveTarget, setStaffRemoveTarget] = useState<AdminVenueStaffRow | null>(null);
  const [addStaffConfirmOpen, setAddStaffConfirmOpen] = useState(false);
  const seededVenueId = useRef<string | null>(null);
  const [geoPin, setGeoPin] = useState({ lat: 0, lng: 0 });
  const [geoPolygonDraft, setGeoPolygonDraft] = useState<GeofencePolygonGeoJson | null>(null);
  const [geoDirty, setGeoDirty] = useState(false);
  const geoSeededForRef = useRef<string | null>(null);
  const [pickedOrg, setPickedOrg] = useState<{ id: string; name: string } | null>(null);

  const venueQ = useAdminVenueDetailQuery(id, getToken, Boolean(isLoaded && id));
  const venueTypeCatalogQ = useAdminVenueTypeCatalogQuery(getToken, Boolean(isLoaded));
  const meQ = usePortalMeQuery(getToken, isLoaded);
  const staffQ = useAdminVenueStaffQuery(id, getToken, Boolean(isLoaded && id));
  const patchMut = useAdminVenuePatchMutation(id, getToken);
  const createVenueTypeMut = useAdminVenueTypeCreateMutation(getToken);
  const staffAddMut = useAdminVenueStaffUpsertMutation(id, getToken);
  const staffRemoveMut = useAdminVenueStaffRemoveMutation(id, getToken);

  const [newVenueTypeCode, setNewVenueTypeCode] = useState("");
  const [newVenueTypeLabel, setNewVenueTypeLabel] = useState("");
  const [createVenueTypeErr, setCreateVenueTypeErr] = useState<string | null>(null);

  const venueForm = useForm({
    defaultValues: {
      menuUrl: "",
      orderingUrl: "",
      venueTypeCodes: [] as string[],
      orderNudgeTitle: "",
      orderNudgeBody: "",
      analyticsTimeZone: "",
      organizationId: "",
      locked: false,
      lockReason: "",
      guestPlayDailyGamesLimit: "",
      requiresExplicitCheckIn: false,
    } as VenueEditForm,
    onSubmit: async ({ value }) => {
      setPageErr(null);
      try {
        if (geoDirty) {
          if (!geoPolygonDraft) {
            setPageErr(
              "Draw a play-area polygon on the map (or keep the existing one) before saving location changes.",
            );
            return;
          }
        }
        const limRaw = value.guestPlayDailyGamesLimit?.trim() ?? "";
        let guestPlayDailyGamesLimit: number | null = null;
        if (limRaw !== "") {
          const n = Number.parseInt(limRaw, 10);
          if (!Number.isFinite(n) || n < 1 || n > 999) {
            setPageErr("Guest daily game cap must be empty (inherit) or an integer 1–999.");
            return;
          }
          guestPlayDailyGamesLimit = n;
        }
        const body: Record<string, unknown> = {
          menuUrl: value.menuUrl || null,
          orderingUrl: value.orderingUrl || null,
          venueTypeCodes: value.venueTypeCodes,
          orderNudgeTitle: value.orderNudgeTitle || null,
          orderNudgeBody: value.orderNudgeBody || null,
          analyticsTimeZone: value.analyticsTimeZone?.trim() || null,
          organizationId: value.organizationId || null,
          locked: value.locked,
          lockReason: value.lockReason?.trim() || null,
          guestPlayDailyGamesLimit,
          requiresExplicitCheckIn: value.requiresExplicitCheckIn,
        };
        if (geoDirty) {
          body.latitude = geoPin.lat;
          body.longitude = geoPin.lng;
          body.geofencePolygon = geoPolygonDraft;
        }
        await patchMut.mutateAsync(body);
        router.push("/venues");
      } catch (e) {
        setPageErr((e as Error).message);
        throw e;
      }
    },
  });

  const addVenueCategory = useCallback(async () => {
    setCreateVenueTypeErr(null);
    const code = newVenueTypeCode.trim();
    if (!code) {
      setCreateVenueTypeErr("Enter a category code.");
      return;
    }
    try {
      const row = await createVenueTypeMut.mutateAsync({
        code,
        label: newVenueTypeLabel.trim() || null,
      });
      const cur = venueForm.state.values.venueTypeCodes ?? [];
      venueForm.setFieldValue("venueTypeCodes", [...new Set([...cur, row.code])]);
      setNewVenueTypeCode("");
      setNewVenueTypeLabel("");
    } catch (e) {
      setCreateVenueTypeErr((e as Error).message);
    }
  }, [createVenueTypeMut, newVenueTypeCode, newVenueTypeLabel, venueForm]);

  useEffect(() => {
    if (!venueQ.data) return;
    const merged = {
      ...venueQ.data,
      organizationId: venueQ.data.organizationId ?? null,
      organization: venueQ.data.organization ?? null,
      locked: venueQ.data.locked ?? false,
      lockReason: venueQ.data.lockReason ?? null,
    } as AdminVenueDetail;
    if (seededVenueId.current !== merged.id) {
      seededVenueId.current = merged.id;
      venueForm.reset(venueToForm(merged));
      setPickedOrg(
        merged.organization
          ? { id: merged.organization.id, name: merged.organization.name }
          : merged.organizationId
            ? { id: merged.organizationId, name: merged.organizationId }
            : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per venue id; form API stable
  }, [venueQ.data]);

  useEffect(() => {
    geoSeededForRef.current = null;
  }, [id]);

  useEffect(() => {
    const data = venueQ.data;
    if (!data || data.id !== id) return;
    if (geoSeededForRef.current === id) return;
    geoSeededForRef.current = id;
    setGeoPin({ lat: data.latitude, lng: data.longitude });
    setGeoPolygonDraft(adminVenueGeofenceToGeoJson(data.geofencePolygon));
    setGeoDirty(false);
  }, [venueQ.data, id]);

  const onGeoPinChange = useCallback((p: { lat: number; lng: number }) => {
    setGeoPin(p);
    setGeoDirty(true);
  }, []);

  const onGeoPolyChange = useCallback((g: GeofencePolygonGeoJson | null) => {
    setGeoPolygonDraft(g);
    setGeoDirty(true);
  }, []);

  const staffRows = staffQ.data ?? [];

  const staffColumns = useMemo(
    () => [
      staffColHelper.accessor((r) => r.player.email, {
        id: "email",
        header: "Email",
        cell: (c) => <span className="text-slate-800">{c.getValue()}</span>,
      }),
      staffColHelper.accessor("role", {
        header: "Role",
        cell: (c) => (
          <span className="text-xs font-mono text-brand">{c.getValue()}</span>
        ),
      }),
      staffColHelper.display({
        id: "rm",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            disabled={staffRemoveMut.isPending || staffAddMut.isPending}
            onClick={() => setStaffRemoveTarget(row.original)}
            className="text-red-600 hover:text-red-800 text-xs"
          >
            Remove
          </button>
        ),
      }),
    ],
    [staffAddMut.isPending, staffRemoveMut.isPending],
  );

  const staffTable = useReactTable({
    data: staffRows,
    columns: staffColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const loadErr =
    venueQ.isError && venueQ.error instanceof Error ? venueQ.error.message : pageErr;

  if (loadErr && !venueQ.data) {
    return (
      <div className="bg-slate-50 text-red-700 p-8">
        {loadErr}{" "}
        <Link href="/venues" className="text-brand">
          Back
        </Link>
      </div>
    );
  }
  if (!venueQ.data) {
    return (
      <div className="bg-slate-50 text-slate-900 p-8">Loading…</div>
    );
  }

  const v = venueQ.data;
  const isSuperAdmin = meQ.data?.platformRole === "SUPER_ADMIN";

  const addStaff = async () => {
    if (!id || !staffEmail.trim()) return;
    setAddStaffConfirmOpen(true);
  };

  const runAddStaff = async () => {
    if (!id || !staffEmail.trim()) return;
    setPageErr(null);
    try {
      await staffAddMut.mutateAsync({
        email: staffEmail.trim(),
        role: staffRole,
      });
      setStaffEmail("");
    } catch (e) {
      setPageErr((e as Error).message);
      throw e;
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen pb-16">
      <form
        className="p-8 max-w-5xl mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          setSaveConfirmOpen(true);
        }}
      >
        <Link href="/venues" className="text-brand text-sm">
          ← Venues
        </Link>
        <h1 className="text-xl font-bold mt-4 mb-1">{v.name}</h1>
        <p className="text-xs text-slate-500 font-mono mb-6">{v.id}</p>
        {/* Organization & access */}
        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Organization &amp; access</h2>
              <p className="mt-1 text-xs text-slate-500">
                Who owns this venue, suspension, and guest play limits.
              </p>
            </div>

            {!meQ.isFetched ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-3 text-sm text-slate-500">
                <span
                  className="inline-block h-4 w-4 animate-pulse rounded-full bg-slate-200"
                  aria-hidden
                />
                Loading account…
              </div>
            ) : isSuperAdmin ? (
              <venueForm.Field name="organizationId">
                {(field) => (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Organization
                    </span>
                    <OrganizationAsyncSelect
                      className="w-full"
                      inputId="venue-organization"
                      value={field.state.value}
                      selected={
                        pickedOrg?.id === field.state.value ? pickedOrg : null
                      }
                      onChange={(nextId, meta) => {
                        field.handleChange(nextId);
                        setPickedOrg(meta);
                      }}
                      getToken={getToken}
                      isDisabled={patchMut.isPending}
                      placeholder="Type to search organizations…"
                    />
                    <p className="text-xs leading-snug text-slate-500">
                      Results load in pages of 20 (search is debounced). Manage billing and structure
                      under{" "}
                      <Link href="/organizations" className="font-medium text-brand hover:underline">
                        Organizations
                      </Link>
                      .
                    </p>
                  </label>
                )}
              </venueForm.Field>
            ) : (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Organization
                </span>
                <p className="mt-1.5 text-sm font-medium text-slate-900">
                  {v.organization?.name ??
                    (v.organizationId ? v.organizationId : "— None —")}
                </p>
                <p className="mt-2 text-xs leading-snug text-slate-500">
                  Only platform admins can attach or move a venue between organizations.
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6 space-y-5">
              <venueForm.Field name="locked">
                {(field) => (
                  <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(e) => {
                        const next = e.target.checked;
                        if (next && !field.state.value) {
                          setLockConfirmOpen(true);
                          return;
                        }
                        field.handleChange(next);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                    />
                    Locked (suspend play &amp; map)
                  </label>
                )}
              </venueForm.Field>

              <venueForm.Field name="requiresExplicitCheckIn">
                {(field) => (
                  <label className="inline-flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(e) => field.handleChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                    />
                    <span className="min-w-0 leading-snug">
                      Require QR check-in at location
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Geofence still detects the venue, but games and venue-gated perks stay locked until the
                        player scans the venue QR with location on (GPS must be inside the geofence). Leave off
                        for automatic unlock when detected inside the fence.
                      </span>
                    </span>
                  </label>
                )}
              </venueForm.Field>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                <venueForm.Field name="lockReason">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Lock reason (optional)
                      </span>
                      <input
                        className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Shown to staff when relevant"
                      />
                    </label>
                  )}
                </venueForm.Field>

                <venueForm.Field name="guestPlayDailyGamesLimit">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Guest daily game cap (optional)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        placeholder="Inherit from org / default"
                        className="w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 lg:max-w-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <p className="text-xs leading-snug text-slate-500">
                        Max QR / guest play sessions per player per calendar day at this venue. Leave
                        empty for the organization default, then the platform env fallback.
                      </p>
                    </label>
                  )}
                </venueForm.Field>
              </div>
            </div>
          </div>
        </section>


        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Location &amp; geofence</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Place the pin and draw the play-area polygon. Same workflow as when creating a venue;
                  geometry is saved with the rest of this form.
                </p>
              </div>
              {v.geofencePolygon ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  Geofence on file
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  No polygon yet
                </span>
              )}
            </div>

            {!v.geofencePolygon ? (
              <div
                className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
                role="status"
              >
                <p className="font-medium text-amber-950">Draw a geofence to enable in-venue detection</p>
                <p className="mt-1 text-xs leading-snug text-amber-900/90">
                  Without a polygon, apps cannot tell when players are inside this venue&apos;s play
                  space. Use the map tools below to add one before saving.
                </p>
              </div>
            ) : null}

            <VenueGeofenceMap
              key={`${v.id}-${v.geofencePolygon ? "p" : "n"}`}
              pin={geoPin}
              onPinChange={onGeoPinChange}
              onPolygonChange={onGeoPolyChange}
              initialPolygon={adminVenueGeofenceToGeoJson(v.geofencePolygon)}
            />
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Menu &amp; ordering</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Public links surfaced in the player experience (for example from venue detail or
                  nudges). Use full URLs including <span className="font-mono text-[11px]">https://</span>.
                  Leave blank if not applicable.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <venueForm.Subscribe selector={(s) => Boolean(s.values.menuUrl?.trim())}>
                  {(hasMenu) =>
                    hasMenu ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        Menu URL set
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        No menu URL
                      </span>
                    )
                  }
                </venueForm.Subscribe>
                <venueForm.Subscribe selector={(s) => Boolean(s.values.orderingUrl?.trim())}>
                  {(hasOrder) =>
                    hasOrder ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        Ordering URL set
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        No ordering URL
                      </span>
                    )
                  }
                </venueForm.Subscribe>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              <venueForm.Field name="menuUrl">
                {(field) => (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Menu URL
                    </span>
                    <input
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://example.com/menu"
                      className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </label>
                )}
              </venueForm.Field>

              <venueForm.Field name="orderingUrl">
                {(field) => (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ordering URL
                    </span>
                    <input
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://order.example.com"
                      className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </label>
                )}
              </venueForm.Field>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Venue categories</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Pick any that apply (for example a coffee shop that also sells games). Dwell push copy
                  is chosen from platform templates using these categories; env defaults apply if none
                  match.
                </p>
              </div>
              <venueForm.Subscribe selector={(s) => s.values.venueTypeCodes?.length ?? 0}>
                {(n) => (
                  <span
                    className={
                      n > 0
                        ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                        : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    }
                  >
                    {n === 0 ? "None selected" : `${n} selected`}
                  </span>
                )}
              </venueForm.Subscribe>
            </div>

            {venueTypeCatalogQ.isError && venueTypeCatalogQ.error instanceof Error ? (
              <div
                className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
                role="alert"
              >
                {venueTypeCatalogQ.error.message}
              </div>
            ) : null}

            {isSuperAdmin ? (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Add category
                    </h3>
                    <p className="mt-1 text-xs leading-snug text-slate-500">
                      Creates a new global tag (e.g.{" "}
                      <span className="font-mono text-[11px] text-slate-600">BOARD_GAME_CAFE</span>).
                      It appears in this list for every venue; link nudge templates to this code in the
                      database if you want template-based copy for it.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Code
                        </span>
                        <input
                          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          value={newVenueTypeCode}
                          onChange={(e) => setNewVenueTypeCode(e.target.value)}
                          placeholder="BOARD_GAME_CAFE"
                          autoComplete="off"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Display label (optional)
                        </span>
                        <input
                          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          value={newVenueTypeLabel}
                          onChange={(e) => setNewVenueTypeLabel(e.target.value)}
                          placeholder="Board game café"
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={createVenueTypeMut.isPending}
                      onClick={() => void addVenueCategory()}
                      className="h-[42px] w-full rounded-lg bg-slate-800 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50 sm:w-auto"
                    >
                      {createVenueTypeMut.isPending ? "Adding…" : "Add & Select"}
                    </button>
                  </div>
                  {createVenueTypeErr ? (
                    <p className="text-xs font-medium text-red-600">{createVenueTypeErr}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <venueForm.Field name="venueTypeCodes">
              {(field) => (
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Categories for this venue
                  </span>
                  {(venueTypeCatalogQ.data ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500">
                      {venueTypeCatalogQ.isPending
                        ? "Loading categories…"
                        : "No categories are defined yet."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {(venueTypeCatalogQ.data ?? []).map((t: AdminVenueTypeRow) => {
                        const checked = (field.state.value ?? []).includes(t.code);
                        return (
                          <label
                            key={t.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-brand/25 ${checked
                              ? "border-emerald-200/90 bg-emerald-50/50"
                              : "border-slate-200/90 bg-white hover:bg-slate-50/90"
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(field.state.value ?? []);
                                if (e.target.checked) next.add(t.code);
                                else next.delete(t.code);
                                field.handleChange([...next]);
                              }}
                            />
                            <span className="min-w-0 leading-snug">
                              <span className="font-medium text-slate-900">
                                {t.label ?? t.code}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                                {t.code}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </venueForm.Field>
          </div>
        </section>

        {/* Nudge & copy */}
        <VenueNudgeSection
          venueId={id}
          getToken={getToken}
          enabled={Boolean(isLoaded && id)}
          isSuperAdmin={Boolean(isSuperAdmin)}
        />

        {isSuperAdmin ? (
          <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Venue-wide copy fallback</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Optional. Used after per-assignment overrides but before template defaults when resolving
                  automatic nudges. Supports{" "}
                  <span className="font-mono text-[11px] text-slate-600">{"{{venueName}}"}</span>.
                </p>
              </div>
              <div className="space-y-5">
                <venueForm.Field name="orderNudgeTitle">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fallback title
                      </span>
                      <input
                        className="w-full min-w-0 max-w-2xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </label>
                  )}
                </venueForm.Field>
                <venueForm.Field name="orderNudgeBody">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fallback body
                      </span>
                      <textarea
                        className="min-h-[88px] w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </label>
                  )}
                </venueForm.Field>
              </div>
            </div>
          </section>
        ) : null}

        {/* Offers */}
        <VenueOffersSection
          venueId={id}
          getToken={getToken}
          enabled={Boolean(isLoaded && id)}
        />

        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Analytics</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                IANA timezone for owner-facing hour-of-day charts in this portal. Leave empty to use
                the default from the environment or organization.
              </p>
            </div>
            <venueForm.Field name="analyticsTimeZone">
              {(field) => (
                <label className="flex max-w-xl min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Timezone (optional)
                  </span>
                  <input
                    className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="e.g. Europe/Zagreb"
                  />
                </label>
              )}
            </venueForm.Field>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Portal staff</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Clerk-backed access: invite people with their real sign-in email. They use this partner
                  portal in the same Clerk project—employees see verification lists; managers and owners see
                  analytics and campaigns.
                </p>
              </div>
              <span
                className={
                  staffRows.length > 0
                    ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                    : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                }
              >
                {staffRows.length === 0
                  ? "No staff"
                  : `${staffRows.length} member${staffRows.length === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add or update access
              </p>
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </span>
                    <input
                      type="email"
                      className={staffFieldText}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="owner@venue.com"
                      autoComplete="email"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role
                    </span>
                    <select
                      className={staffFieldSelect}
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value as AdminVenueStaffRow["role"])}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={staffAddMut.isPending}
                  onClick={() => void addStaff()}
                  className="h-[42px] w-full rounded-lg bg-slate-800 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50 sm:w-auto"
                >
                  {staffAddMut.isPending ? "Working…" : "Add / update"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current access
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
                {staffRows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">No staff yet.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/90">
                      {staffTable.getHeaderGroups().map((hg) => (
                        <tr
                          key={hg.id}
                          className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {hg.headers.map((h) => (
                            <th key={h.id} className="px-3 py-2.5 pr-3 text-left">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {staffTable.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-3 py-2.5 align-top">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Save venue settings</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                Writes everything in this form (organization, access, URLs, categories, geofence,
                nudges, fallback copy, analytics). Perks and challenges below save on their own actions.
              </p>
            </div>
            {pageErr ? (
              <div
                className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
                role="alert"
              >
                {pageErr}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={patchMut.isPending}
              className="mx-auto block w-full max-w-md rounded-lg border border-brand-active bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {patchMut.isPending ? "Saving…" : "Save venue settings…"}
            </button>
          </div>
        </section>
      </form>

      {/* Save confirmation modal */}
      <ConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="Save venue?"
        description={
          <p>
            Save changes to <span className="font-semibold text-slate-900">{v.name}</span>? You will
            return to the venue list.
          </p>
        }
        confirmLabel="Save"
        onConfirm={() => venueForm.handleSubmit()}
      />

      {/* Lock confirmation modal */}
      <ConfirmModal
        open={lockConfirmOpen}
        onClose={() => setLockConfirmOpen(false)}
        title="Lock this venue?"
        variant="danger"
        description={
          <p>
            Players lose access to this venue on the map and in play until you unlock it again. You
            still need to save the form for the lock to apply.
          </p>
        }
        confirmLabel="Lock venue"
        onConfirm={async () => {
          venueForm.setFieldValue("locked", true);
        }}
      />

      {/* Staff removal confirmation modal */}
      <ConfirmModal
        open={staffRemoveTarget !== null}
        onClose={() => setStaffRemoveTarget(null)}
        title="Remove staff member?"
        variant="danger"
        description={
          staffRemoveTarget ? (
            <p>
              Remove{" "}
              <span className="font-semibold text-slate-900">
                {staffRemoveTarget.player.email}
              </span>{" "}
              ({staffRemoveTarget.role}) from this venue?
            </p>
          ) : null
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!staffRemoveTarget || !id) return;
          setPageErr(null);
          try {
            await staffRemoveMut.mutateAsync(staffRemoveTarget.playerId);
          } catch (e) {
            setPageErr((e as Error).message);
            throw e;
          }
        }}
      />

      {/* Staff addition confirmation modal */}
      <ConfirmModal
        open={addStaffConfirmOpen}
        onClose={() => setAddStaffConfirmOpen(false)}
        title="Add or update staff?"
        description={
          <p>
            Invite <span className="font-semibold text-slate-900">{staffEmail.trim()}</span> as{" "}
            <span className="font-mono text-slate-800">{staffRole}</span>?
          </p>
        }
        confirmLabel="Add / update"
        onConfirm={runAddStaff}
      />

      <div className="mx-auto max-w-5xl space-y-8 px-8 pb-12">
        <VenuePerksSection
          venueId={id}
          getToken={getToken}
          enabled={Boolean(isLoaded && id)}
          variant="embedded"
        />
        <VenueChallengesSection
          venueId={id}
          getToken={getToken}
          enabled={Boolean(isLoaded && id)}
          variant="embedded"
        />
      </div>
    </div>
  );
}
