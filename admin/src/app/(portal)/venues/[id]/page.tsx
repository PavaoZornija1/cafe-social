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
};

const staffColHelper = createColumnHelper<AdminVenueStaffRow>();

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

        {!meQ.isFetched ? (
          <p className="text-sm text-slate-500 mb-3">Loading account…</p>
        ) : isSuperAdmin ? (
          <venueForm.Field name="organizationId">
            {(field) => (
              <label className="block mb-3">
                <span className="text-sm font-medium text-slate-800">Organization</span>
                <OrganizationAsyncSelect
                  className="mt-1.5"
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
                <p className="text-xs text-slate-500 mt-1.5">
                  Results load from the server in pages of 20 (search is debounced). Manage billing
                  and structure under{" "}
                  <Link href="/organizations" className="text-brand hover:underline">
                    Organizations
                  </Link>
                  .
                </p>
              </label>
            )}
          </venueForm.Field>
        ) : (
          <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="text-sm font-medium text-slate-800">Organization</span>
            <p className="mt-1 text-sm text-slate-900">
              {v.organization?.name ??
                (v.organizationId ? v.organizationId : "— None —")}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Only platform admins can attach or move a venue between organizations.
            </p>
          </div>
        )}

        <venueForm.Field name="locked">
        {(field) => (
          <label className="flex items-center gap-2 mb-3">
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
            />
            <span className="text-sm text-slate-800">Locked (suspend play & map)</span>
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="lockReason">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Lock reason (optional)</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="guestPlayDailyGamesLimit">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">
              Guest daily game cap (optional)
            </span>
            <input
              type="number"
              min={1}
              max={999}
              placeholder="inherit from organization / default"
              className="mt-1 w-full max-w-xs bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            <p className="text-xs text-slate-500 mt-1">
              Max QR / guest play sessions per player per calendar day at this venue. Leave empty to
              use the organization default, then the platform env fallback.
            </p>
          </label>
        )}
      </venueForm.Field>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Location &amp; geofence</h2>
        <p className="text-xs text-slate-600">
          Drag the pin and draw the play area — same map as when creating a venue under an
          organization. Location updates are included when you save this page.
        </p>
        <VenueGeofenceMap
          key={`${v.id}-${v.geofencePolygon ? "p" : "n"}`}
          pin={geoPin}
          onPinChange={onGeoPinChange}
          onPolygonChange={onGeoPolyChange}
          initialPolygon={adminVenueGeofenceToGeoJson(v.geofencePolygon)}
        />
        {!v.geofencePolygon ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            This venue has no geofence yet. Draw a polygon so in-venue play can detect the space.
          </p>
        ) : null}
      </div>

      <venueForm.Field name="menuUrl">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Menu URL</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="orderingUrl">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Ordering URL</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Venue categories</h2>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl">
          Pick any that apply (for example a coffee shop that also sells games). Dwell push copy is
          chosen from platform templates using these categories; env defaults apply if none match.
        </p>
        {venueTypeCatalogQ.isError &&
        venueTypeCatalogQ.error instanceof Error ? (
          <p className="text-xs text-red-600 mt-2">{venueTypeCatalogQ.error.message}</p>
        ) : null}
        {isSuperAdmin ? (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
              Add category
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Creates a new global tag (e.g. <span className="font-mono">BOARD_GAME_CAFE</span>). It
              appears in this list for every venue; link nudge templates to this code in the database
              if you want template-based copy for it.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600 block min-w-[10rem]">
                Code
                <input
                  className="mt-0.5 block w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                  value={newVenueTypeCode}
                  onChange={(e) => setNewVenueTypeCode(e.target.value)}
                  placeholder="BOARD_GAME_CAFE"
                  autoComplete="off"
                />
              </label>
              <label className="text-xs text-slate-600 block min-w-[12rem] flex-1 max-w-md">
                Display label (optional)
                <input
                  className="mt-0.5 block w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={newVenueTypeLabel}
                  onChange={(e) => setNewVenueTypeLabel(e.target.value)}
                  placeholder="Board game café"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                disabled={createVenueTypeMut.isPending}
                onClick={() => void addVenueCategory()}
                className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"
              >
                {createVenueTypeMut.isPending ? "Adding…" : "Add & select"}
              </button>
            </div>
            {createVenueTypeErr ? (
              <p className="text-xs text-red-600 mt-2">{createVenueTypeErr}</p>
            ) : null}
          </div>
        ) : null}
        <venueForm.Field name="venueTypeCodes">
          {(field) => (
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
              {(venueTypeCatalogQ.data ?? []).map((t: AdminVenueTypeRow) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={(field.state.value ?? []).includes(t.code)}
                    onChange={(e) => {
                      const next = new Set(field.state.value ?? []);
                      if (e.target.checked) next.add(t.code);
                      else next.delete(t.code);
                      field.handleChange([...next]);
                    }}
                  />
                  <span>{t.label ?? t.code}</span>
                  <span className="text-xs text-slate-400 font-mono">({t.code})</span>
                </label>
              ))}
            </div>
          )}
        </venueForm.Field>
      </div>

      <VenueNudgeSection
        venueId={id}
        getToken={getToken}
        enabled={Boolean(isLoaded && id)}
        isSuperAdmin={Boolean(isSuperAdmin)}
      />

      {isSuperAdmin ? (
        <>
          <h2 className="text-sm font-semibold text-slate-900 mt-2">Venue-wide copy fallback</h2>
          <p className="text-xs text-slate-500 mb-2 max-w-3xl">
            Optional. Used after per-assignment overrides but before template defaults when resolving
            automatic nudges. Supports <span className="font-mono">{"{{venueName}}"}</span>.
          </p>
          <venueForm.Field name="orderNudgeTitle">
            {(field) => (
              <label className="block mb-3">
                <span className="text-sm text-slate-600">Fallback title</span>
                <input
                  className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </label>
            )}
          </venueForm.Field>

          <venueForm.Field name="orderNudgeBody">
            {(field) => (
              <label className="block mb-3">
                <span className="text-sm text-slate-600">Fallback body</span>
                <textarea
                  className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm min-h-[72px]"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </label>
            )}
          </venueForm.Field>
        </>
      ) : null}

      <VenueOffersSection
        venueId={id}
        getToken={getToken}
        enabled={Boolean(isLoaded && id)}
      />

      <venueForm.Field name="analyticsTimeZone">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">
              Analytics timezone (IANA, optional — hour-of-day charts for owners)
            </span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g. Europe/Zagreb"
            />
          </label>
        )}
      </venueForm.Field>

      <div className="border border-slate-300 rounded-lg p-4 mb-4 space-y-3">
        <p className="text-sm text-slate-800 font-semibold">
          Owner / manager / employee (Clerk)
        </p>
        <p className="text-xs text-slate-500">
          Invite people with their real sign-in email. They use this partner portal with the same
          Clerk project: employees see verification lists; managers and owners see analytics and
          campaigns.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block text-sm text-slate-600 flex-1 min-w-[200px]">
            Email
            <input
              type="email"
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="owner@venue.com"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Role
            <select
              className="mt-1 block w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as AdminVenueStaffRow["role"])}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>
          <button
            type="button"
            disabled={staffAddMut.isPending}
            onClick={() => void addStaff()}
            className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
          >
            Add / update
          </button>
        </div>
        <div className="rounded border border-slate-200 overflow-x-auto bg-white">
          {staffRows.length === 0 ? (
            <p className="text-sm text-slate-500 p-3">No staff yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                {staffTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="text-left px-3 py-2 text-xs uppercase text-slate-500"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {staffTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 bg-slate-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
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

        {pageErr ? <p className="text-red-600 text-sm mb-2">{pageErr}</p> : null}
        <button
          type="submit"
          disabled={patchMut.isPending}
          className="mt-4 w-full max-w-xl bg-brand border border-brand-active text-white hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-semibold"
        >
          {patchMut.isPending ? "Saving…" : "Save venue settings…"}
        </button>
      </form>

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

      <div className="px-8 max-w-5xl mx-auto space-y-10">
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
