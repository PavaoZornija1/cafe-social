import { apiGet } from './api';

export type DiscoveryVenuePin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  country: string | null;
  isPremium: boolean;
  venueTypeCodes?: string[];
  hasActiveOffer?: boolean;
};

export type DiscoveryMapFilters = {
  venueTypeCodes?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  hasActiveOffer?: boolean;
};

function buildDiscoveryQuery(filters?: DiscoveryMapFilters): string {
  if (!filters) return '';
  const p = new URLSearchParams();
  if (filters.venueTypeCodes?.length) {
    p.set('venueTypeCodes', filters.venueTypeCodes.join(','));
  }
  if (
    typeof filters.lat === 'number' &&
    typeof filters.lng === 'number' &&
    Number.isFinite(filters.lat) &&
    Number.isFinite(filters.lng)
  ) {
    p.set('lat', String(filters.lat));
    p.set('lng', String(filters.lng));
  }
  if (
    typeof filters.radiusKm === 'number' &&
    Number.isFinite(filters.radiusKm) &&
    filters.radiusKm > 0
  ) {
    p.set('radiusKm', String(filters.radiusKm));
  }
  if (filters.hasActiveOffer) {
    p.set('hasActiveOffer', 'true');
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function fetchDiscoveryVenuePins(
  filters?: DiscoveryMapFilters,
): Promise<DiscoveryVenuePin[]> {
  return apiGet<DiscoveryVenuePin[]>(`/venues/discovery/map${buildDiscoveryQuery(filters)}`);
}
