import { BadRequestException } from '@nestjs/common';
import type { Venue } from '@prisma/client';
import {
  area,
  booleanPointInPolygon,
  booleanValid,
  circle,
  point,
  polygon as turfPolygon,
} from '@turf/turf';
import type { Polygon as GeoJsonPolygon } from 'geojson';

const MIN_AREA_M2 = 25;
const MAX_AREA_M2 = 5_000_000;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusM = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Validates and returns a GeoJSON Polygon suitable for JSON storage.
 */
export function parseVenueGeofencePolygonInput(input: unknown): GeoJsonPolygon {
  if (input === null || input === undefined || typeof input !== 'object') {
    throw new BadRequestException('geofencePolygon must be a GeoJSON Polygon object');
  }
  const raw = input as { type?: unknown; coordinates?: unknown };
  if (raw.type !== 'Polygon') {
    throw new BadRequestException('geofencePolygon.type must be "Polygon"');
  }
  if (!Array.isArray(raw.coordinates)) {
    throw new BadRequestException('geofencePolygon.coordinates must be an array of rings');
  }
  const coords = raw.coordinates as number[][][];
  if (coords.length < 1) {
    throw new BadRequestException('Polygon must have at least one ring');
  }
  const outer = coords[0];
  if (!Array.isArray(outer) || outer.length < 4) {
    throw new BadRequestException(
      'Polygon outer ring must have at least 4 positions (closed ring)',
    );
  }
  for (const ring of coords) {
    for (const pos of ring) {
      if (!Array.isArray(pos) || pos.length < 2) {
        throw new BadRequestException('Invalid polygon position');
      }
      const [lng, lat] = pos;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new BadRequestException('Polygon coordinates must be finite numbers');
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new BadRequestException('Polygon coordinate out of valid range');
      }
    }
  }

  const poly = turfPolygon(coords);
  if (!booleanValid(poly)) {
    throw new BadRequestException('Invalid polygon geometry');
  }

  const a = area(poly);
  if (a < MIN_AREA_M2) {
    throw new BadRequestException(`Polygon area too small (minimum about ${MIN_AREA_M2} m²)`);
  }
  if (a > MAX_AREA_M2) {
    throw new BadRequestException(`Polygon area too large (maximum about ${MAX_AREA_M2} m²)`);
  }

  return poly.geometry;
}

export function assertPinInsidePolygon(
  latitude: number,
  longitude: number,
  polygon: GeoJsonPolygon,
): void {
  const poly = turfPolygon(polygon.coordinates);
  const pt = point([longitude, latitude]);
  if (!booleanPointInPolygon(pt, poly)) {
    throw new BadRequestException('Venue pin must lie inside the drawn geofence');
  }
}

/**
 * Circular geofence as a GeoJSON Polygon (for storage). Containment uses the stored polygon only.
 */
export function polygonFromCenterRadiusMeters(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): GeoJsonPolygon {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new BadRequestException('radiusMeters must be positive to build a geofence polygon');
  }
  const feat = circle([longitude, latitude], radiusMeters, {
    steps: 64,
    units: 'meters',
  });
  return feat.geometry;
}

export function pointInVenueGeofence(
  latitude: number,
  longitude: number,
  venue: Pick<Venue, 'geofencePolygon'>,
): boolean {
  const polyJson = venue.geofencePolygon;
  if (polyJson === null || polyJson === undefined) {
    return false;
  }
  try {
    const g = polyJson as unknown as GeoJsonPolygon;
    if (g.type !== 'Polygon' || !Array.isArray(g.coordinates)) {
      return false;
    }
    const poly = turfPolygon(g.coordinates);
    return booleanPointInPolygon(point([longitude, latitude]), poly);
  } catch {
    return false;
  }
}

export function distanceToVenuePinMeters(
  latitude: number,
  longitude: number,
  venue: Pick<Venue, 'latitude' | 'longitude'>,
): number {
  return haversineMeters(latitude, longitude, venue.latitude, venue.longitude);
}
