"use client";

import { useForm } from "@tanstack/react-form";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";
import { OrganizationAsyncSelect } from "@/components/ui/OrganizationAsyncSelect";
import {
  type AdminVenueDetail,
  type AdminVenueTypeRow,
  useAdminVenuePatchMutation,
  useAdminVenueTypeCatalogQuery,
  useAdminVenueTypeCreateMutation,
} from "@/lib/queries";

const VenueGeofenceMap = dynamic(() => import("@/components/VenueGeofenceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(420px,55vh)] w-full rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

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
  guestPlayDailyGamesLimit: string;
  requiresExplicitCheckIn: boolean;
};

function adminVenueGeofenceToGeoJson(raw: unknown): GeofencePolygonGeoJson | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { type?: unknown; coordinates?: unknown };
  if (obj.type !== "Polygon" || !Array.isArray(obj.coordinates)) return null;
  return { type: "Polygon", coordinates: obj.coordinates as number[][][] };
}

function venueToForm(venue: AdminVenueDetail): VenueEditForm {
  return {
    menuUrl: venue.menuUrl ?? "",
    orderingUrl: venue.orderingUrl ?? "",
    venueTypeCodes: venue.venueTypes?.map((type) => type.code) ?? [],
    orderNudgeTitle: venue.orderNudgeTitle ?? "",
    orderNudgeBody: venue.orderNudgeBody ?? "",
    analyticsTimeZone: venue.analyticsTimeZone ?? "",
    organizationId: venue.organizationId ?? "",
    locked: venue.locked ?? false,
    lockReason: venue.lockReason ?? "",
    guestPlayDailyGamesLimit:
      venue.guestPlayDailyGamesLimit != null ? String(venue.guestPlayDailyGamesLimit) : "",
    requiresExplicitCheckIn: venue.requiresExplicitCheckIn ?? false,
  };
}

export function VenueCmsSettingsSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { venueId, venue, getToken, isLoaded, isSuperAdmin } = useVenueCmsEditor();

  const [pageErr, setPageErr] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [geoPin, setGeoPin] = useState({ lat: 0, lng: 0 });
  const [geoPolygonDraft, setGeoPolygonDraft] = useState<GeofencePolygonGeoJson | null>(null);
  const [geoDirty, setGeoDirty] = useState(false);
  const [arrivalRadiusMeters, setArrivalRadiusMeters] = useState(100);
  const [proximityAlertsEnabled, setProximityAlertsEnabled] = useState(true);
  const [pickedOrg, setPickedOrg] = useState<{ id: string; name: string } | null>(null);
  const [newVenueTypeCode, setNewVenueTypeCode] = useState("");
  const [newVenueTypeLabel, setNewVenueTypeLabel] = useState("");
  const [createVenueTypeErr, setCreateVenueTypeErr] = useState<string | null>(null);

  const seededVenueId = useRef<string | null>(null);
  const geoSeededForRef = useRef<string | null>(null);

  const venueTypeCatalogQ = useAdminVenueTypeCatalogQuery(getToken, Boolean(isLoaded));
  const patchMut = useAdminVenuePatchMutation(venueId, getToken);
  const createVenueTypeMut = useAdminVenueTypeCreateMutation(getToken);

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
        if (geoDirty && !geoPolygonDraft) {
          setPageErr(t("admin.venueCms.editor.errGeofenceRequired"));
          return;
        }
        const limitRaw = value.guestPlayDailyGamesLimit?.trim() ?? "";
        let guestPlayDailyGamesLimit: number | null = null;
        if (limitRaw !== "") {
          const parsed = Number.parseInt(limitRaw, 10);
          if (!Number.isFinite(parsed) || parsed < 1 || parsed > 999) {
            setPageErr(t("admin.venueCms.editor.errGuestCapInvalid"));
            return;
          }
          guestPlayDailyGamesLimit = parsed;
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
      } catch (error) {
        setPageErr((error as Error).message);
        throw error;
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
      const currentCodes = venueForm.state.values.venueTypeCodes ?? [];
      venueForm.setFieldValue("venueTypeCodes", [...new Set([...currentCodes, row.code])]);
      setNewVenueTypeCode("");
      setNewVenueTypeLabel("");
    } catch (error) {
      setCreateVenueTypeErr((error as Error).message);
    }
  }, [createVenueTypeMut, newVenueTypeCode, newVenueTypeLabel, t, venueForm]);

  useEffect(() => {
    if (!venue) return;
    const mergedVenue = {
      ...venue,
      organizationId: venue.organizationId ?? null,
      organization: venue.organization ?? null,
      locked: venue.locked ?? false,
      lockReason: venue.lockReason ?? null,
    } as AdminVenueDetail;
    if (seededVenueId.current !== mergedVenue.id) {
      seededVenueId.current = mergedVenue.id;
      venueForm.reset(venueToForm(mergedVenue));
      setPickedOrg(
        mergedVenue.organization
          ? { id: mergedVenue.organization.id, name: mergedVenue.organization.name }
          : mergedVenue.organizationId
            ? { id: mergedVenue.organizationId, name: mergedVenue.organizationId }
            : null,
      );
    }
  }, [venue, venueForm]);

  useEffect(() => {
    geoSeededForRef.current = null;
  }, [venueId]);

  useEffect(() => {
    if (!venue || venue.id !== venueId) return;
    if (geoSeededForRef.current === venueId) return;
    geoSeededForRef.current = venueId;
    setGeoPin({ lat: venue.latitude, lng: venue.longitude });
    setGeoPolygonDraft(adminVenueGeofenceToGeoJson(venue.geofencePolygon));
    setGeoDirty(false);
    setArrivalRadiusMeters(venue.proximityAlertRadiusMeters ?? 100);
    setProximityAlertsEnabled(venue.proximityAlertsEnabled ?? true);
  }, [venue, venueId]);

  const onGeoPinChange = useCallback((pin: { lat: number; lng: number }) => {
    setGeoPin(pin);
    setGeoDirty(true);
    setArrivalRadiusMeters(100);
  }, []);

  const onGeoPolyChange = useCallback((polygon: GeofencePolygonGeoJson | null) => {
    setGeoPolygonDraft(polygon);
    setGeoDirty(true);
  }, []);

  if (!venue) return null;

  return (
    <>
      <form
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          setSaveConfirmOpen(true);
        }}
      >
        <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.orgAccessTitle")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("admin.venueCms.editor.orgAccessLead")}</p>
            </div>

            {!isLoaded ? (
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
                      selected={pickedOrg?.id === field.state.value ? pickedOrg : null}
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
                  {venue.organization?.name ?? (venue.organizationId ? venue.organizationId : "— None —")}
                </p>
                <p className="mt-2 text-xs leading-snug text-slate-500">
                  {t("admin.venueCms.editor.orgReadOnlyHintPlatform")}
                </p>
              </div>
            )}

            <div className="space-y-5 border-t border-slate-100 pt-6">
              <venueForm.Field name="locked">
                {(field) => (
                  <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(event) => {
                        const next = event.target.checked;
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
                      onChange={(event) => field.handleChange(event.target.checked)}
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
                        onChange={(event) => field.handleChange(event.target.value)}
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
                        onChange={(event) => field.handleChange(event.target.value)}
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
              {venue.geofencePolygon ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  {t("admin.venueCms.editor.geofenceOnFile")}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  {t("admin.venueCms.editor.noPolygonYet")}
                </span>
              )}
            </div>

            {!venue.geofencePolygon ? (
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
              key={`${venue.id}-${venue.geofencePolygon ? "p" : "n"}`}
              pin={geoPin}
              onPinChange={onGeoPinChange}
              onPolygonChange={onGeoPolyChange}
              initialPolygon={adminVenueGeofenceToGeoJson(venue.geofencePolygon)}
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
                <venueForm.Subscribe selector={(state) => Boolean(state.values.menuUrl?.trim())}>
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
                <venueForm.Subscribe selector={(state) => Boolean(state.values.orderingUrl?.trim())}>
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
                      onChange={(event) => field.handleChange(event.target.value)}
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
                      onChange={(event) => field.handleChange(event.target.value)}
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
              <venueForm.Subscribe selector={(state) => state.values.venueTypeCodes?.length ?? 0}>
                {(count) => (
                  <span
                    className={
                      count > 0
                        ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                        : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    }
                  >
                    {count === 0
                      ? t("admin.venueCms.editor.noneSelected")
                      : t("admin.venueCms.editor.selectedCount", { count })}
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
                          onChange={(event) => setNewVenueTypeCode(event.target.value)}
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
                          onChange={(event) => setNewVenueTypeLabel(event.target.value)}
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
                      {(venueTypeCatalogQ.data ?? []).map((venueType: AdminVenueTypeRow) => {
                        const checked = (field.state.value ?? []).includes(venueType.code);
                        return (
                          <label
                            key={venueType.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-brand/25 ${
                              checked
                                ? "border-emerald-200/90 bg-emerald-50/50"
                                : "border-slate-200/90 bg-white hover:bg-slate-50/90"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                              checked={checked}
                              onChange={(event) => {
                                const next = new Set(field.state.value ?? []);
                                if (event.target.checked) {
                                  next.add(venueType.code);
                                } else {
                                  next.delete(venueType.code);
                                }
                                field.handleChange([...next]);
                              }}
                            />
                            <span className="min-w-0 leading-snug">
                              <span className="font-medium text-slate-900">
                                {venueType.label ?? venueType.code}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                                {venueType.code}
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
                        onChange={(event) => field.handleChange(event.target.value)}
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
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </label>
                  )}
                </venueForm.Field>
              </div>
            </div>
          </section>
        ) : null}

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
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t("admin.venueCms.editor.timezonePlaceholder")}
                  />
                </label>
              )}
            </venueForm.Field>
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

      <ConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title={t("admin.venueCms.editor.saveConfirmTitle")}
        description={<p>{t("admin.venueCms.editor.saveConfirmBody", { name: venue.name })}</p>}
        confirmLabel={t("admin.venueCms.common.save")}
        onConfirm={() => venueForm.handleSubmit()}
      />

      <ConfirmModal
        open={lockConfirmOpen}
        onClose={() => setLockConfirmOpen(false)}
        title={t("admin.venueCms.editor.lockConfirmTitle")}
        variant="danger"
        description={<p>{t("admin.venueCms.editor.lockConfirmBody")}</p>}
        confirmLabel={t("admin.venueCms.editor.lockConfirmLabel")}
        onConfirm={async () => {
          venueForm.setFieldValue("locked", true);
        }}
      />
    </>
  );
}
