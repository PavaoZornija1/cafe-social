/** Normalized forward-geocode hit for partner portal address search. */
export type GeocodeSearchHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  /** ISO 3166-1 alpha-2 uppercase */
  country?: string;
};

type MapboxContextItem = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  center?: [number, number];
  text?: string;
  address?: string;
  context?: MapboxContextItem[];
  properties?: { address?: string };
};

export type MapboxGeocodeResponse = {
  features?: MapboxFeature[];
};

export function mapboxFeatureToHit(f: MapboxFeature): GeocodeSearchHit | null {
  const center = f.center;
  if (!center || center.length < 2) return null;
  const lng = center[0];
  const lat = center[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const label = f.place_name?.trim() || f.text?.trim() || "";
  if (!label) return null;

  let city: string | undefined;
  let country: string | undefined;
  for (const ctx of f.context ?? []) {
    const id = ctx.id ?? "";
    if (id.startsWith("place.") || id.startsWith("locality.")) {
      city = ctx.text?.trim() || city;
    }
    if (id.startsWith("country.")) {
      const sc = ctx.short_code?.trim().replace(/^country:/i, "") ?? "";
      if (sc.length === 2) country = sc.toUpperCase();
    }
  }

  const streetNum = f.address?.trim() || f.properties?.address?.trim();
  const name = f.text?.trim();
  let address: string | undefined;
  if (streetNum && name && streetNum !== name) {
    address = `${name} ${streetNum}`.trim();
  } else if (streetNum) {
    address = streetNum;
  } else if (name && !label.startsWith(name)) {
    address = name;
  }

  return {
    id: f.id ?? `${lat},${lng}`,
    label,
    lat,
    lng,
    ...(address && { address }),
    ...(city && { city }),
    ...(country && { country }),
  };
}
