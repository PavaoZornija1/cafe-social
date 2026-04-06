import { apiGet } from './api';
import {
  buildDetectQuery,
  getCoordinatesForVenueDetect,
  type Coordinates,
  type VenueDetectLocationAccuracy,
} from './locationForDetect';

export type DetectedVenue = {
  id: string;
  name: string;
  isPremium: boolean;
  /** Partner / billing pause — venue still shown in geofence. */
  locked?: boolean;
  city?: string | null;
  country?: string | null;
};

export type VenueDetectResult = {
  venue: DetectedVenue | null;
  coords: Coordinates | null;
};

export type FetchDetectedVenueOptions = {
  /** Stronger GPS fix for polygon geofence checks (redemptions, location-required challenges). */
  locationAccuracy?: VenueDetectLocationAccuracy;
};

/**
 * Geofence detection only (no default venue). Without GPS permission or outside all fences, venue is null.
 * Server uses venue polygon + pin distance (closest containing fence wins).
 */
export async function fetchDetectedVenue(
  options?: FetchDetectedVenueOptions,
): Promise<VenueDetectResult> {
  const coords = await getCoordinatesForVenueDetect(options?.locationAccuracy ?? 'balanced');
  const q = buildDetectQuery(coords);
  const venue = await apiGet<DetectedVenue | null>(`/venue-context/detect${q}`);
  return { venue, coords };
}

/** Query string for GET /venue-context/:id/access (same coords as detection). */
export function buildVenueAccessQuery(coords: Coordinates | null): string {
  if (!coords) return '';
  return `?lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(String(coords.lng))}`;
}
