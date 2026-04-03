"use client";

import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PartnerOnboardingPayload } from "@/lib/portalApi";
import { usePartnerOnboardingMutation, usePortalMeQuery } from "@/lib/queries";

const STEPS = 4;

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const meQ = usePortalMeQuery(getToken, isLoaded);
  const onboardMut = usePartnerOnboardingMutation(getToken);

  const form = useForm({
    defaultValues: {
      locationKind: "SINGLE_LOCATION" as PartnerOnboardingPayload["locationKind"],
      organizationName: "",
      venueName: "",
      address: "",
      city: "",
      country: "",
      latitude: "",
      longitude: "",
      radiusMeters: "80",
      analyticsTimeZone: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitErr(null);
      const lat = Number.parseFloat(value.latitude);
      const lng = Number.parseFloat(value.longitude);
      const r = Number.parseInt(value.radiusMeters, 10);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        setSubmitErr("Enter a valid latitude (-90 to 90).");
        return;
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        setSubmitErr("Enter a valid longitude (-180 to 180).");
        return;
      }
      if (!Number.isFinite(r) || r < 10 || r > 5000) {
        setSubmitErr("Radius must be between 10 and 5000 meters.");
        return;
      }

      const payload: PartnerOnboardingPayload = {
        locationKind: value.locationKind,
        organizationName: value.organizationName.trim(),
        venueName: value.venueName.trim(),
        latitude: lat,
        longitude: lng,
        radiusMeters: r,
        ...(value.address.trim() && { address: value.address.trim() }),
        ...(value.city.trim() && { city: value.city.trim() }),
        ...(value.country.trim() && { country: value.country.trim() }),
        ...(value.analyticsTimeZone.trim() && {
          analyticsTimeZone: value.analyticsTimeZone.trim(),
        }),
      };

      await onboardMut.mutateAsync(payload);
      router.replace("/owner/venues");
    },
  });

  useEffect(() => {
    if (!meQ.data || meQ.isPending) return;
    if (!meQ.data.needsPartnerOnboarding) {
      router.replace("/owner/venues");
    }
  }, [meQ.data, meQ.isPending, router]);

  if (!isLoaded) {
    return <div className="p-8 text-slate-600 text-sm">Loading…</div>;
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
          Partner setup
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          Welcome to Cafe Social
        </h1>
        <p className="text-sm text-slate-600 mb-8">
          Step {step + 1} of {STEPS} — your trial includes full features for one location for 14
          days.
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
                  <p className="text-sm text-slate-700 font-medium">How do you operate?</p>
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 p-4 hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-brand-light/40">
                    <input
                      type="radio"
                      name="kind"
                      className="mt-1"
                      checked={field.state.value === "SINGLE_LOCATION"}
                      onChange={() => field.handleChange("SINGLE_LOCATION")}
                    />
                    <span>
                      <span className="font-medium text-slate-900">Single location</span>
                      <span className="block text-xs text-slate-600 mt-1">
                        One café, bar, or venue.
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
                      <span className="font-medium text-slate-900">Multiple locations</span>
                      <span className="block text-xs text-slate-600 mt-1">
                        Franchise or group — trial still covers one site; add more after you
                        subscribe.
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
                    Organization name
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="e.g. Northside Coffee Group"
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
                    <label className="block text-sm font-medium text-slate-800">Venue name</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="e.g. Northside · Main Street"
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="address">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      Address (optional)
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
              <div className="grid grid-cols-2 gap-3">
                <form.Field name="city">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-slate-800">City</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="country">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-slate-800">Country</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Set the geofence for gameplay. Use decimal degrees (e.g. from Google Maps).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <form.Field name="latitude">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-slate-800">Latitude</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="45.8150"
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="longitude">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-slate-800">Longitude</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="15.9819"
                      />
                    </div>
                  )}
                </form.Field>
              </div>
              <form.Field name="radiusMeters">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      Radius (meters)
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      type="number"
                      min={10}
                      max={5000}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="analyticsTimeZone">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
                      Timezone (optional, IANA)
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Europe/Zagreb"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          ) : null}

          <form.Subscribe
            selector={(s) => ({
              locationKind: s.values.locationKind,
              organizationName: s.values.organizationName,
              venueName: s.values.venueName,
              latitude: s.values.latitude,
              longitude: s.values.longitude,
            })}
          >
            {(v) => {
              const latN = Number.parseFloat(v.latitude);
              const lngN = Number.parseFloat(v.longitude);
              const geoOk =
                Number.isFinite(latN) &&
                latN >= -90 &&
                latN <= 90 &&
                Number.isFinite(lngN) &&
                lngN >= -180 &&
                lngN <= 180;
              const canNext =
                step === 0 ||
                (step === 1 && v.organizationName.trim().length > 0) ||
                (step === 2 && v.venueName.trim().length > 0) ||
                (step === 3 && geoOk);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {step > 0 ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS - 1 ? (
                    <button
                      type="button"
                      disabled={!canNext}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
                      onClick={() => setStep((s) => Math.min(STEPS - 1, s + 1))}
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={onboardMut.isPending || !canNext}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
                    >
                      {onboardMut.isPending ? "Creating…" : "Finish setup"}
                    </button>
                  )}
                </div>
              );
            }}
          </form.Subscribe>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Were you invited to a team?{" "}
          <Link href="/owner/accept-invite" className="text-brand font-medium hover:underline">
            Accept invite
          </Link>
        </p>
      </div>
    </form>
  );
}
