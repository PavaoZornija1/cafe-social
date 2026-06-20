"use client";

import { useAuth } from "@clerk/nextjs";
import { useForm, useStore } from "@tanstack/react-form";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { CitySelect } from "@/components/ui/CitySelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import type { PartnerOnboardingPayload } from "@/lib/portalApi";
import { usePartnerOnboardingMutation, usePortalMeQuery } from "@/lib/queries";

const VenueGeofenceMap = dynamic(() => import("@/components/VenueGeofenceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(420px,55vh)] w-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

const DEFAULT_ONBOARD_PIN = { lat: 46.0569, lng: 14.5058 };
const STEPS = 4;

function OnboardingCompletingView() {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-brand-lighter via-[var(--background)] to-white px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 rounded-xl bg-brand animate-pulse shadow-portal-card"
        aria-hidden
      />
      <div className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
      <h1 className="mt-6 text-lg font-semibold text-slate-900 text-center">
        {t("admin.partnerOnboarding.completingTitle")}
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-slate-600 leading-relaxed">
        {t("admin.partnerOnboarding.completingBody")}
      </p>
    </div>
  );
}

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [geoPin, setGeoPin] = useState(DEFAULT_ONBOARD_PIN);
  const [geoPolygon, setGeoPolygon] = useState<GeofencePolygonGeoJson | null>(null);
  const [mapLayoutKey, setMapLayoutKey] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const meQ = usePortalMeQuery(getToken, isLoaded);
  const onboardMut = usePartnerOnboardingMutation(getToken);
  const prevNeedsOnboardingRef = useRef<boolean | null>(null);
  const [accessGrantedMidFlow, setAccessGrantedMidFlow] = useState(false);

  const form = useForm({
    defaultValues: {
      locationKind: "SINGLE_LOCATION" as PartnerOnboardingPayload["locationKind"],
      organizationName: "",
      venueName: "",
      address: "",
      city: "",
      country: "",
      analyticsTimeZone: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitErr(null);
      if (!geoPolygon) {
        setSubmitErr(t("admin.partnerOnboarding.errorNoPolygon"));
        return;
      }

      const payload: PartnerOnboardingPayload = {
        locationKind: value.locationKind,
        organizationName: value.organizationName.trim(),
        venueName: value.venueName.trim(),
        latitude: geoPin.lat,
        longitude: geoPin.lng,
        geofencePolygon: geoPolygon as unknown as Record<string, unknown>,
        ...(value.address.trim() && { address: value.address.trim() }),
        ...(value.city.trim() && { city: value.city.trim() }),
        ...(value.country.trim() && { country: value.country.trim() }),
        ...(value.analyticsTimeZone.trim() && {
          analyticsTimeZone: value.analyticsTimeZone.trim(),
        }),
      };

      setIsFinishing(true);
      try {
        await onboardMut.mutateAsync(payload);
        const refreshed = await meQ.refetch();
        if (refreshed.data?.needsPartnerOnboarding) {
          setIsFinishing(false);
          setSubmitErr(t("admin.partnerOnboarding.errorProfileStale"));
          return;
        }
        router.replace("/owner/venues");
      } catch {
        setIsFinishing(false);
      }
    },
  });

  const onPinChange = useCallback((p: { lat: number; lng: number }) => {
    setGeoPin(p);
  }, []);

  const onPolygonChange = useCallback((g: GeofencePolygonGeoJson | null) => {
    setGeoPolygon(g);
  }, []);

  const organizationName = useStore(form.store, (s) => s.values.organizationName);
  const venueName = useStore(form.store, (s) => s.values.venueName);

  useEffect(() => {
    if (isFinishing) return;
    if (!meQ.data || meQ.isPending) return;
    const needs = meQ.data.needsPartnerOnboarding;

    if (prevNeedsOnboardingRef.current === null) {
      prevNeedsOnboardingRef.current = needs;
      if (!needs) {
        router.replace("/owner/venues");
      }
      return;
    }

    if (prevNeedsOnboardingRef.current === true && needs === false) {
      setAccessGrantedMidFlow(true);
      const id = window.setTimeout(() => {
        router.replace("/owner/venues");
      }, 2400);
      prevNeedsOnboardingRef.current = false;
      return () => window.clearTimeout(id);
    }

    prevNeedsOnboardingRef.current = needs;
  }, [isFinishing, meQ.data, meQ.isPending, router]);

  if (!isLoaded) {
    return <div className="p-8 text-slate-600 text-sm">{t("admin.partnerOnboarding.loading")}</div>;
  }

  if (isFinishing) {
    return <OnboardingCompletingView />;
  }

  if (accessGrantedMidFlow) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200/90 bg-emerald-50/90 px-6 py-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-emerald-950">
            {t("admin.partnerOnboarding.accessGrantedTitle")}
          </h1>
          <p className="mt-3 text-sm text-emerald-900/90 leading-relaxed">
            {t("admin.partnerOnboarding.accessGrantedBody")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="min-h-full flex flex-col items-center px-4 py-10 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="w-full max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-2">
          {t("admin.partnerOnboarding.wizardLabel")}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          {t("admin.partnerOnboarding.welcomeTitle")}
        </h1>
        <p className="text-sm text-slate-600 mb-8">
          {t("admin.partnerOnboarding.stepLead", { step: step + 1, total: STEPS })}
        </p>

        {(submitErr ||
          (onboardMut.isError && onboardMut.error instanceof Error
            ? onboardMut.error.message
            : null)) ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {submitErr ??
              (onboardMut.error instanceof Error ? onboardMut.error.message : null)}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-portal-card p-6 sm:p-8 space-y-6">
          {step === 0 ? (
            <form.Field name="locationKind">
              {(field) => (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 font-medium">
                    {t("admin.partnerOnboarding.howOperate")}
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 p-4 hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-brand-light/40">
                    <input
                      type="radio"
                      name="kind"
                      className="mt-1"
                      checked={field.state.value === "SINGLE_LOCATION"}
                      onChange={() => field.handleChange("SINGLE_LOCATION")}
                    />
                    <span>
                      <span className="font-medium text-slate-900">
                        {t("admin.partnerOnboarding.singleLocationTitle")}
                      </span>
                      <span className="block text-xs text-slate-600 mt-1">
                        {t("admin.partnerOnboarding.singleLocationDesc")}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 p-4 hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-brand-light/40">
                    <input
                      type="radio"
                      name="kind"
                      className="mt-1"
                      checked={field.state.value === "MULTI_LOCATION"}
                      onChange={() => field.handleChange("MULTI_LOCATION")}
                    />
                    <span>
                      <span className="font-medium text-slate-900">
                        {t("admin.partnerOnboarding.multiLocationTitle")}
                      </span>
                      <span className="block text-xs text-slate-600 mt-1">
                        {t("admin.partnerOnboarding.multiLocationDesc")}
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </form.Field>
          ) : null}

          {step === 1 ? (
            <form.Field name="organizationName">
              {(field) => (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-800">
                    {t("admin.partnerOnboarding.organizationName")}
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t("admin.partnerOnboarding.organizationNamePlaceholder")}
                  />
                </div>
              )}
            </form.Field>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <form.Field name="venueName">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      {t("admin.partnerOnboarding.venueName")}
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t("admin.partnerOnboarding.venueNamePlaceholder")}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="address">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      {t("admin.partnerOnboarding.addressOptional")}
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="country">
                  {(field) => (
                    <div>
                      <label
                        className="block text-sm font-medium text-slate-800"
                        htmlFor="onboard-country"
                      >
                        {t("admin.partnerOnboarding.country")}
                      </label>
                      <CountrySelect
                        id="onboard-country"
                        className="mt-1"
                        value={field.state.value}
                        onChange={(iso) => {
                          const prev = field.state.value;
                          field.handleChange(iso);
                          if (iso !== prev) form.setFieldValue("city", "");
                        }}
                        placeholder={t("admin.partnerOnboarding.countrySearchPlaceholder")}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {t("admin.partnerOnboarding.countryIsoHint")}
                      </p>
                    </div>
                  )}
                </form.Field>
                <form.Subscribe selector={(s) => s.values.country}>
                  {(country) => (
                    <form.Field name="city">
                      {(field) => (
                        <div>
                          <label
                            className="block text-sm font-medium text-slate-800"
                            htmlFor="onboard-city"
                          >
                            {t("admin.partnerOnboarding.city")}
                          </label>
                          <CitySelect
                            id="onboard-city"
                            className="mt-1"
                            countryCode={country}
                            cityName={field.state.value}
                            onChange={(name) => field.handleChange(name)}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{t("admin.partnerOnboarding.mapLead")}</p>
              <form.Subscribe selector={(s) => s.values.country}>
                {(country) => (
                  <div key={mapLayoutKey}>
                    <VenueGeofenceMap
                      pin={geoPin}
                      onPinChange={onPinChange}
                      onPolygonChange={onPolygonChange}
                      searchCountryBias={country || undefined}
                      onAddressResolved={(fields) => {
                        if (fields.address) form.setFieldValue("address", fields.address);
                        if (fields.city) form.setFieldValue("city", fields.city);
                        if (fields.country) form.setFieldValue("country", fields.country);
                      }}
                    />
                  </div>
                )}
              </form.Subscribe>
              <form.Field name="analyticsTimeZone">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      {t("admin.partnerOnboarding.timezoneOptional")}
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t("admin.partnerOnboarding.timezonePlaceholder")}
                    />
                  </div>
                )}
              </form.Field>
            </div>
          ) : null}

          {(() => {
            const canNext =
              step === 0 ||
              (step === 1 && organizationName.trim().length > 0) ||
              (step === 2 && venueName.trim().length > 0) ||
              (step === 3 && geoPolygon !== null);

            return (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {step > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    {t("admin.partnerOnboarding.back")}
                  </button>
                ) : (
                  <span />
                )}
                {step < STEPS - 1 ? (
                  <button
                    type="button"
                    disabled={!canNext}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
                    onClick={() => {
                      setStep((s) => {
                        const next = Math.min(STEPS - 1, s + 1);
                        if (s === 2) {
                          setGeoPolygon(null);
                          setGeoPin(DEFAULT_ONBOARD_PIN);
                          setMapLayoutKey((k) => k + 1);
                        }
                        return next;
                      });
                    }}
                  >
                    {t("admin.partnerOnboarding.continue")}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={onboardMut.isPending || !canNext}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
                  >
                    {onboardMut.isPending
                      ? t("admin.partnerOnboarding.creating")
                      : t("admin.partnerOnboarding.finishSetup")}
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          {t("admin.partnerOnboarding.inviteLead")}{" "}
          <Link href="/owner/accept-invite" className="text-brand font-medium hover:underline">
            {t("admin.partnerOnboarding.acceptInvite")}
          </Link>
        </p>
      </div>
    </form>
  );
}
