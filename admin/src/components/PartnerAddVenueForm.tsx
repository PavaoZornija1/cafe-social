"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { CitySelect } from "@/components/ui/CitySelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { isPartnerOrgBillingActive } from "@/lib/partnerBillingStatus";
import { useOwnerCreateVenueUnderOrgMutation } from "@/lib/queries";

const VenueGeofenceMap = dynamic(() => import("@/components/VenueGeofenceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(360px,50vh)] w-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

const DEFAULT_PIN = { lat: 46.0569, lng: 14.5058 };

export type PartnerAddVenueOrgContext = {
  id: string;
  name: string;
  locationKind: string;
  trialEndsAt: string | null;
  platformBillingStatus: string;
  venueCount: number;
};

type Props = {
  org: PartnerAddVenueOrgContext;
  getToken: () => Promise<string | null>;
  onCreated?: () => void;
};

export function PartnerAddVenueForm({ org, getToken, onCreated }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [pin, setPin] = useState(DEFAULT_PIN);
  const [polygon, setPolygon] = useState<GeofencePolygonGeoJson | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const createMut = useOwnerCreateVenueUnderOrgMutation(org.id, getToken);

  const paying = isPartnerOrgBillingActive(org.platformBillingStatus);
  const trialEnd = org.trialEndsAt ? new Date(org.trialEndsAt).getTime() : null;
  const inTrial =
    trialEnd !== null && trialEnd > Date.now() && !paying;
  const isMulti = org.locationKind === "MULTI_LOCATION";
  const trialBlocksSecondSite = inTrial && org.venueCount >= 1;
  const canAdd = isMulti && !trialBlocksSecondSite;

  const resetForm = useCallback(() => {
    setName("");
    setAddress("");
    setCity("");
    setCountry("");
    setPin(DEFAULT_PIN);
    setPolygon(null);
    setMapKey((k) => k + 1);
    setErr(null);
  }, []);

  if (!isMulti) {
    return null;
  }

  if (trialBlocksSecondSite) {
    return (
      <section className="rounded-2xl border border-amber-200/90 bg-amber-50/80 px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-amber-950">
          {t("admin.partnerAddVenue.trialOneSiteTitle")}
        </h2>
        <p className="mt-2 text-sm text-amber-900/90 leading-relaxed">
          {t("admin.partnerAddVenue.trialOneSiteBody")}
        </p>
        <Link
          href="/owner/subscriptions"
          className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover transition-colors"
        >
          {t("admin.partnerAddVenue.trialSubscribeCta")}
        </Link>
      </section>
    );
  }

  if (!canAdd) {
    return null;
  }

  const handleCreate = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr(t("admin.partnerAddVenue.errorNameRequired"));
      return;
    }
    if (!polygon) {
      setErr(t("admin.partnerAddVenue.errorNoPolygon"));
      return;
    }
    try {
      await createMut.mutateAsync({
        name: name.trim(),
        latitude: pin.lat,
        longitude: pin.lng,
        geofencePolygon: polygon as unknown as { type: "Polygon"; coordinates: number[][][] },
        ...(address.trim() && { address: address.trim() }),
        ...(city.trim() && { city: city.trim() }),
        ...(country.trim() && { country: country.trim() }),
      });
      resetForm();
      setOpen(false);
      onCreated?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04] overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t("admin.partnerAddVenue.title")}
          </h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-xl">
            {t("admin.partnerAddVenue.lead", { orgName: org.name })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            if (!open) resetForm();
            setOpen((v) => !v);
          }}
          className={
            open
              ? "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              : "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover"
          }
        >
          {open ? t("admin.partnerAddVenue.close") : t("admin.partnerAddVenue.open")}
        </button>
      </div>

      {open ? (
        <div className="px-5 py-5 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              {t("admin.partnerAddVenue.venueName")}
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.partnerAddVenue.venueNamePlaceholder")}
            />
          </label>

          <div key={mapKey}>
            <VenueGeofenceMap
              pin={pin}
              onPinChange={setPin}
              onPolygonChange={setPolygon}
              searchCountryBias={country || undefined}
              onAddressResolved={(fields) => {
                if (fields.address) setAddress(fields.address);
                if (fields.city) setCity(fields.city);
                if (fields.country) setCountry(fields.country);
              }}
            />
          </div>

          <fieldset className="rounded-xl border border-dashed border-slate-300 px-4 py-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.partnerAddVenue.addressOptional")}
            </legend>
            <div className="space-y-3 mt-2">
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("admin.partnerAddVenue.streetPlaceholder")}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CountrySelect
                  value={country}
                  onChange={(iso) => {
                    setCountry(iso);
                    if (iso !== country) setCity("");
                  }}
                  placeholder={t("admin.partnerAddVenue.countryPlaceholder")}
                />
                <CitySelect
                  countryCode={country}
                  cityName={city}
                  onChange={setCity}
                />
              </div>
            </div>
          </fieldset>

          {err ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {err}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              {t("admin.partnerAddVenue.cancel")}
            </button>
            <button
              type="button"
              disabled={createMut.isPending || !polygon}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-40"
            >
              {createMut.isPending
                ? t("admin.partnerAddVenue.creating")
                : t("admin.partnerAddVenue.create")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
