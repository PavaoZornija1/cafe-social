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
import { useTranslation } from "react-i18next";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableRowCards } from "@/components/TableRowCards";
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
  const { t } = useTranslation();
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
  const [arrivalRadiusMeters, setArrivalRadiusMeters] = useState(100);
  const [proximityAlertsEnabled, setProximityAlertsEnabled] = useState(true);
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
            setPageErr(t("admin.venueCms.editor.errGeofenceRequired"));
            return;
          }
        }
        const limRaw = value.guestPlayDailyGamesLimit?.trim() ?? "";
        let guestPlayDailyGamesLimit: number | null = null;
        if (limRaw !== "") {
          const n = Number.parseInt(limRaw, 10);
          if (!Number.isFinite(n) || n < 1 || n > 999) {
            setPageErr(t("admin.venueCms.editor.errGuestCapInvalid"));
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
          proximityAlertRadiusMeters: arrivalRadiusMeters,
          proximityAlertsEnabled,
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
      setCreateVenueTypeErr(t("admin.venueCms.editor.errCategoryCodeRequired"));
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
  }, [createVenueTypeMut, newVenueTypeCode, newVenueTypeLabel, venueForm, t]);

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
    setArrivalRadiusMeters(data.proximityAlertRadiusMeters ?? 100);
    setProximityAlertsEnabled(data.proximityAlertsEnabled ?? true);
  }, [venueQ.data, id]);

  const onGeoPinChange = useCallback((p: { lat: number; lng: number }) => {
    setGeoPin(p);
    setGeoDirty(true);
    setArrivalRadiusMeters(100);
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
        header: t("admin.venueCms.common.email"),
        cell: (c) => <span className="text-slate-800">{c.getValue()}</span>,
      }),
      staffColHelper.accessor("role", {
        header: t("admin.venueCms.common.role"),
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
            {t("admin.venueCms.common.remove")}
          </button>
        ),
      }),
    ],
    [staffAddMut.isPending, staffRemoveMut.isPending, t],
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
      <div className="bg-slate-50 text-red-700 px-4 py-6 sm:p-8">
        {loadErr}{" "}
        <Link href="/venues" className="text-brand">
          {t("admin.venueCms.editor.back")}
        </Link>
      </div>
    );
  }
  if (!venueQ.data) {
    return (
      <div className="bg-slate-50 text-slate-900 px-4 py-6 sm:p-8">{t("admin.venueCms.editor.loading")}</div>
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
        className="px-4 py-5 sm:p-6 md:p-8 max-w-5xl mx-auto w-full"
        onSubmit={(e) => {
          e.preventDefault();
          setSaveConfirmOpen(true);
        }}
      >
        <Link href="/venues" className="text-brand text-sm">
          {t("admin.venueCms.editor.backVenues")}
        </Link>
        <h1 className="text-xl font-bold mt-4 mb-1">{v.name}</h1>
        <p className="text-xs text-slate-500 font-mono mb-6">{v.id}</p>
        {/* Organization & access */}
        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.orgAccessTitle")}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("admin.venueCms.editor.orgAccessLead")}
              </p>
            </div>

            {!meQ.isFetched ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-3 text-sm text-slate-500">
                <span
                  className="inline-block h-4 w-4 animate-pulse rounded-full bg-slate-200"
                  aria-hidden
                />
                {t("admin.venueCms.editor.loadingAccount")}
              </div>
            ) : isSuperAdmin ? (
              <venueForm.Field name="organizationId">
                {(field) => (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venueCms.editor.organization")}
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
                      placeholder={t("admin.venueCms.editor.orgSearchPlaceholder")}
                    />
                    <p className="text-xs leading-snug text-slate-500">
                      {t("admin.venueCms.editor.orgSearchHintSuperAdmin")}{" "}
                      <Link href="/organizations" className="font-medium text-brand hover:underline">
                        {t("admin.venueCms.editor.organizationsLink")}
                      </Link>
                      .
                    </p>
                  </label>
                )}
              </venueForm.Field>
            ) : (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("admin.venueCms.editor.orgReadOnly")}
                </span>
                <p className="mt-1.5 text-sm font-medium text-slate-900">
                  {v.organization?.name ??
                    (v.organizationId ? v.organizationId : "— None —")}
                </p>
                <p className="mt-2 text-xs leading-snug text-slate-500">
                  {t("admin.venueCms.editor.orgReadOnlyHintPlatform")}
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
                    {t("admin.venueCms.editor.lockedLabel")}
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
                      {t("admin.venueCms.editor.requiresCheckInLabel")}
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {t("admin.venueCms.editor.requiresCheckInHint")}
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
                        {t("admin.venueCms.editor.lockReasonLabel")}
                      </span>
                      <input
                        className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={t("admin.venueCms.editor.lockReasonPlaceholder")}
                      />
                    </label>
                  )}
                </venueForm.Field>

                <venueForm.Field name="guestPlayDailyGamesLimit">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("admin.venueCms.editor.guestCapLabel")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        placeholder={t("admin.venueCms.editor.guestCapPlaceholder")}
                        className="w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 lg:max-w-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <p className="text-xs leading-snug text-slate-500">
                        {t("admin.venueCms.editor.guestCapHint")}
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
                <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.locationTitle")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  {t("admin.venueCms.editor.locationLead")}
                </p>
              </div>
              {v.geofencePolygon ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  {t("admin.venueCms.editor.geofenceOnFile")}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  {t("admin.venueCms.editor.noPolygonYet")}
                </span>
              )}
            </div>

            {!v.geofencePolygon ? (
              <div
                className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
                role="status"
              >
                <p className="font-medium text-amber-950">{t("admin.venueCms.editor.geofenceAlertTitle")}</p>
                <p className="mt-1 text-xs leading-snug text-amber-900/90">
                  {t("admin.venueCms.editor.geofenceAlertBody")}
                </p>
              </div>
            ) : null}

            <VenueGeofenceMap
              key={`${v.id}-${v.geofencePolygon ? "p" : "n"}`}
              pin={geoPin}
              onPinChange={onGeoPinChange}
              onPolygonChange={onGeoPolyChange}
              initialPolygon={adminVenueGeofenceToGeoJson(v.geofencePolygon)}
              arrivalRadiusMeters={arrivalRadiusMeters}
              onArrivalRadiusChange={setArrivalRadiusMeters}
              proximityAlertsEnabled={proximityAlertsEnabled}
              onProximityAlertsEnabledChange={setProximityAlertsEnabled}
            />
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.menuTitle")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  {t("admin.venueCms.editor.menuLead")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <venueForm.Subscribe selector={(s) => Boolean(s.values.menuUrl?.trim())}>
                  {(hasMenu) =>
                    hasMenu ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {t("admin.venueCms.editor.badgeMenuUrlSet")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {t("admin.venueCms.editor.badgeNoMenuUrl")}
                      </span>
                    )
                  }
                </venueForm.Subscribe>
                <venueForm.Subscribe selector={(s) => Boolean(s.values.orderingUrl?.trim())}>
                  {(hasOrder) =>
                    hasOrder ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {t("admin.venueCms.editor.badgeOrderingUrlSet")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {t("admin.venueCms.editor.badgeNoOrderingUrl")}
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
                      {t("admin.venueCms.editor.menuUrlLabel")}
                    </span>
                    <input
                      inputMode="url"
                      autoComplete="url"
                      placeholder={t("admin.venueCms.editor.menuUrlPlaceholder")}
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
                      {t("admin.venueCms.editor.orderingUrlLabel")}
                    </span>
                    <input
                      inputMode="url"
                      autoComplete="url"
                      placeholder={t("admin.venueCms.editor.orderingUrlPlaceholder")}
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
                <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.categoriesTitle")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  {t("admin.venueCms.editor.categoriesLead")}
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
                    {n === 0
                      ? t("admin.venueCms.editor.noneSelected")
                      : t("admin.venueCms.editor.selectedCount", { count: n })}
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
                      {t("admin.venueCms.editor.addCategoryTitle")}
                    </h3>
                    <p className="mt-1 text-xs leading-snug text-slate-500">
                      {t("admin.venueCms.editor.addCategoryLead")}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("admin.venueCms.common.code")}
                        </span>
                        <input
                          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          value={newVenueTypeCode}
                          onChange={(e) => setNewVenueTypeCode(e.target.value)}
                          placeholder={t("admin.venueCms.editor.categoryCodePlaceholder")}
                          autoComplete="off"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("admin.venueCms.editor.displayLabelOptional")}
                        </span>
                        <input
                          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          value={newVenueTypeLabel}
                          onChange={(e) => setNewVenueTypeLabel(e.target.value)}
                          placeholder={t("admin.venueCms.editor.categoryLabelPlaceholder")}
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
                      {createVenueTypeMut.isPending
                        ? t("admin.venueCms.common.adding")
                        : t("admin.venueCms.editor.addAndSelect")}
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
                    {t("admin.venueCms.editor.categoriesForVenue")}
                  </span>
                  {(venueTypeCatalogQ.data ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500">
                      {venueTypeCatalogQ.isPending
                        ? t("admin.venueCms.editor.loadingCategories")
                        : t("admin.venueCms.editor.noCategoriesDefined")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {(venueTypeCatalogQ.data ?? []).map((vt: AdminVenueTypeRow) => {
                        const checked = (field.state.value ?? []).includes(vt.code);
                        return (
                          <label
                            key={vt.id}
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
                                if (e.target.checked) next.add(vt.code);
                                else next.delete(vt.code);
                                field.handleChange([...next]);
                              }}
                            />
                            <span className="min-w-0 leading-snug">
                              <span className="font-medium text-slate-900">
                                {vt.label ?? vt.code}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                                {vt.code}
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
                <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.copyFallbackTitle")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  {t("admin.venueCms.editor.copyFallbackLead")}
                </p>
              </div>
              <div className="space-y-5">
                <venueForm.Field name="orderNudgeTitle">
                  {(field) => (
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("admin.venueCms.editor.fallbackTitleLabel")}
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
                        {t("admin.venueCms.editor.fallbackBodyLabel")}
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
              <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.analyticsTitle")}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                {t("admin.venueCms.editor.analyticsLead")}
              </p>
            </div>
            <venueForm.Field name="analyticsTimeZone">
              {(field) => (
                <label className="flex max-w-xl min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.venueCms.editor.timezoneOptional")}
                  </span>
                  <input
                    className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t("admin.venueCms.editor.timezonePlaceholder")}
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
                <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.staffTitle")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                  {t("admin.venueCms.editor.staffLead")}
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
                  ? t("admin.venueCms.editor.staffBadgeNone")
                  : t("admin.venueCms.editor.staffBadgeCount", { count: staffRows.length })}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("admin.venueCms.editor.addOrUpdateAccess")}
              </p>
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venueCms.common.email")}
                    </span>
                    <input
                      type="email"
                      className={staffFieldText}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder={t("admin.venueCms.editor.staffEmailPlaceholder")}
                      autoComplete="email"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venueCms.editor.staffRoleLabel")}
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
                  {staffAddMut.isPending ? t("admin.venueCms.common.working") : t("admin.venueCms.common.addUpdate")}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("admin.venueCms.editor.currentAccess")}
              </p>
              <div className="mt-3 rounded-xl border border-slate-200/90 bg-white shadow-sm">
                {staffRows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">{t("admin.venueCms.editor.noStaff")}</p>
                ) : (
                  <>
          <TableRowCards rows={staffTable.getRowModel().rows} leadCellId="email" actionCellIds={["rm"]} />
                    <div className="hidden md:block overflow-x-auto">
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
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.saveTitle")}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                {t("admin.venueCms.editor.saveLead")}
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
              {patchMut.isPending ? t("admin.venueCms.common.saving") : t("admin.venueCms.editor.saveVenueSettings")}
            </button>
          </div>
        </section>
      </form>

      {/* Save confirmation modal */}
      <ConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title={t("admin.venueCms.editor.saveConfirmTitle")}
        description={
          <p>
            {t("admin.venueCms.editor.saveConfirmBody", { name: v.name })}
          </p>
        }
        confirmLabel={t("admin.venueCms.common.save")}
        onConfirm={() => venueForm.handleSubmit()}
      />

      {/* Lock confirmation modal */}
      <ConfirmModal
        open={lockConfirmOpen}
        onClose={() => setLockConfirmOpen(false)}
        title={t("admin.venueCms.editor.lockConfirmTitle")}
        variant="danger"
        description={
          <p>
            {t("admin.venueCms.editor.lockConfirmBody")}
          </p>
        }
        confirmLabel={t("admin.venueCms.editor.lockConfirmLabel")}
        onConfirm={async () => {
          venueForm.setFieldValue("locked", true);
        }}
      />

      {/* Staff removal confirmation modal */}
      <ConfirmModal
        open={staffRemoveTarget !== null}
        onClose={() => setStaffRemoveTarget(null)}
        title={t("admin.venueCms.editor.removeStaffTitle")}
        variant="danger"
        description={
          staffRemoveTarget ? (
            <p>
              {t("admin.venueCms.editor.removeStaffBody", {
                email: staffRemoveTarget.player.email,
                role: staffRemoveTarget.role,
              })}
            </p>
          ) : null
        }
        confirmLabel={t("admin.venueCms.common.remove")}
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
        title={t("admin.venueCms.editor.inviteConfirmTitle")}
        description={
          <p>
            {t("admin.venueCms.editor.inviteConfirmBody", {
              email: staffEmail.trim(),
              role: staffRole,
            })}
          </p>
        }
        confirmLabel={t("admin.venueCms.common.addUpdate")}
        onConfirm={runAddStaff}
      />

      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 md:px-8 pb-12">
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
