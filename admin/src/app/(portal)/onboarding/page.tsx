"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchPortalMe,
  partnerOnboardingBootstrap,
  type PartnerOnboardingPayload,
} from "../../../lib/portalApi";

const STEPS = 4;

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locationKind, setLocationKind] = useState<
    "SINGLE_LOCATION" | "MULTI_LOCATION"
  >("SINGLE_LOCATION");
  const [organizationName, setOrganizationName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("80");
  const [analyticsTimeZone, setAnalyticsTimeZone] = useState("");

  const gate = useCallback(async () => {
    const me = await fetchPortalMe(getToken);
    if (!me.needsPartnerOnboarding) {
      router.replace("/owner/venues");
    }
  }, [getToken, router]);

  useEffect(() => {
    if (!isLoaded) return;
    void gate();
  }, [isLoaded, gate]);

  const latN = Number.parseFloat(latitude);
  const lngN = Number.parseFloat(longitude);
  const geoOk =
    Number.isFinite(latN) &&
    latN >= -90 &&
    latN <= 90 &&
    Number.isFinite(lngN) &&
    lngN >= -180 &&
    lngN <= 180;

  const canNext =
    step === 0 ||
    (step === 1 && organizationName.trim().length > 0) ||
    (step === 2 && venueName.trim().length > 0) ||
    (step === 3 && geoOk);

  async function submit() {
    setErr(null);
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    const r = Number.parseInt(radiusMeters, 10);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErr("Enter a valid latitude (-90 to 90).");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setErr("Enter a valid longitude (-180 to 180).");
      return;
    }
    if (!Number.isFinite(r) || r < 10 || r > 5000) {
      setErr("Radius must be between 10 and 5000 meters.");
      return;
    }

    const payload: PartnerOnboardingPayload = {
      locationKind,
      organizationName: organizationName.trim(),
      venueName: venueName.trim(),
      latitude: lat,
      longitude: lng,
      radiusMeters: r,
      ...(address.trim() && { address: address.trim() }),
      ...(city.trim() && { city: city.trim() }),
      ...(country.trim() && { country: country.trim() }),
      ...(analyticsTimeZone.trim() && {
        analyticsTimeZone: analyticsTimeZone.trim(),
      }),
    };

    setBusy(true);
    try {
      await partnerOnboardingBootstrap(getToken, payload);
      router.replace("/owner/venues");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="p-8 text-slate-600 text-sm">Loading…</div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-10 pb-24">
      <div className="w-full max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-2">
          Partner setup
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          Welcome to Cafe Social
        </h1>
        <p className="text-sm text-slate-600 mb-8">
          Step {step + 1} of {STEPS} — your trial includes full features for one
          location for 14 days.
        </p>

        {err ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-portal-card p-6 sm:p-8 space-y-6">
          {step === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                How do you operate?
              </p>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 p-4 hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-brand-light/40">
                <input
                  type="radio"
                  name="kind"
                  className="mt-1"
                  checked={locationKind === "SINGLE_LOCATION"}
                  onChange={() => setLocationKind("SINGLE_LOCATION")}
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
                  checked={locationKind === "MULTI_LOCATION"}
                  onChange={() => setLocationKind("MULTI_LOCATION")}
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Multiple locations
                  </span>
                  <span className="block text-xs text-slate-600 mt-1">
                    Franchise or group — trial still covers one site; add more
                    after you subscribe.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-800">
                Organization name
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Northside Coffee Group"
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Venue name
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g. Northside · Main Street"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Address (optional)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    City
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Country
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Set the geofence for gameplay. Use decimal degrees (e.g. from
                Google Maps).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Latitude
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="45.8150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Longitude
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="15.9819"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Radius (meters)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  type="number"
                  min={10}
                  max={5000}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Timezone (optional, IANA)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                  value={analyticsTimeZone}
                  onChange={(e) => setAnalyticsTimeZone(e.target.value)}
                  placeholder="Europe/Zagreb"
                />
              </div>
            </div>
          ) : null}

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
                type="button"
                disabled={busy || !canNext}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
                onClick={() => void submit()}
              >
                {busy ? "Creating…" : "Finish setup"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Were you invited to a team?{" "}
          <Link href="/owner/accept-invite" className="text-brand font-medium hover:underline">
            Accept invite
          </Link>
        </p>
      </div>
    </div>
  );
}
