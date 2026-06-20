"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { geocodeSearch, type GeocodeSearchHit } from "@/lib/portalApi";

export type AddressGeocodeSelection = {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  city?: string;
  country?: string;
};

type Props = {
  /** ISO 3166-1 alpha-2 — biases results (e.g. onboarding country). */
  countryBias?: string;
  /** Bias toward current map pin when searching. */
  proximity?: { lat: number; lng: number };
  onSelect: (hit: AddressGeocodeSelection) => void;
  className?: string;
  disabled?: boolean;
};

export function AddressGeocodeSearch({
  countryBias,
  proximity,
  onSelect,
  className,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || disabled) return;
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setLoading(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await geocodeSearch(getToken, {
            q,
            country: countryBias?.trim() || undefined,
            proximityLat: proximity?.lat,
            proximityLng: proximity?.lng,
          });
          setHits(rows);
          setOpen(true);
          setActiveIdx(-1);
        } catch (e) {
          setHits([]);
          setErr((e as Error).message);
        } finally {
          setLoading(false);
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, countryBias, proximity?.lat, proximity?.lng, getToken, isLoaded, disabled]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (hit: GeocodeSearchHit) => {
      setQuery(hit.label);
      setOpen(false);
      setHits([]);
      onSelect({
        lat: hit.lat,
        lng: hit.lng,
        label: hit.label,
        address: hit.address,
        city: hit.city,
        country: hit.country,
      });
    },
    [onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(hits[activeIdx]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={className}>
      <label className="block text-sm font-medium text-slate-800" htmlFor={listId}>
        {t("admin.addressGeocode.label")}
      </label>
      <p className="text-xs text-slate-500 mt-0.5 mb-1.5 leading-relaxed">
        {t("admin.addressGeocode.hint")}
      </p>
      <div className="relative">
        <input
          id={listId}
          type="search"
          autoComplete="off"
          disabled={disabled || !isLoaded}
          placeholder={t("admin.addressGeocode.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
        />
        {loading ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {t("admin.addressGeocode.searching")}
          </span>
        ) : null}
        {open && hits.length > 0 ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            {hits.map((hit, idx) => (
              <li key={hit.id} role="option" aria-selected={idx === activeIdx}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    idx === activeIdx ? "bg-brand-light/60" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(hit)}
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {err ? (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      <p className="mt-1.5 text-[10px] text-slate-400">{t("admin.addressGeocode.attribution")}</p>
    </div>
  );
}
