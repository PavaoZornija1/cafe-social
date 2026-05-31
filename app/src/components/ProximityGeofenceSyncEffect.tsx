import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { apiGet } from '../lib/api';
import { getCoordinatesForVenueDetect } from '../lib/locationForDetect';
import {
  syncProximityGeofenceRegions,
  stopProximityGeofenceMonitoring,
  type ProximityGeofenceRegion,
} from '../lib/venueGeofenceTask';

const RESYNC_INTERVAL_MS = 30 * 60 * 1000;
const RESYNC_DISTANCE_M = 500;

type ApiRegion = {
  venueId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Keeps OS geofence regions in sync with the nearest partner arrival rings.
 * Runs while signed in; refreshes on app foreground and when the user moves ~500m.
 */
export function ProximityGeofenceSyncEffect() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const lastSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isLoaded || !isSignedIn) {
      void stopProximityGeofenceMonitoring();
      return;
    }

    let cancelled = false;

    async function sync(force: boolean) {
      const token = await getTokenRef.current();
      if (!token || cancelled) return;

      const coords = await getCoordinatesForVenueDetect('balanced');
      if (!coords || cancelled) return;

      const prev = lastSyncRef.current;
      const now = Date.now();
      if (
        !force &&
        prev &&
        now - prev.at < RESYNC_INTERVAL_MS &&
        haversineMeters(prev.lat, prev.lng, coords.lat, coords.lng) < RESYNC_DISTANCE_M
      ) {
        return;
      }

      try {
        const qs = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          limit: '20',
        });
        const rows = await apiGet<ApiRegion[]>(
          `/venues/proximity-geofences/near?${qs.toString()}`,
          token,
        );
        if (cancelled) return;

        const regions: ProximityGeofenceRegion[] = (Array.isArray(rows) ? rows : []).map((r) => ({
          venueId: r.venueId,
          latitude: r.latitude,
          longitude: r.longitude,
          radiusMeters: r.radiusMeters,
        }));

        await syncProximityGeofenceRegions(regions);
        if (!cancelled) {
          lastSyncRef.current = { lat: coords.lat, lng: coords.lng, at: now };
        }
      } catch {
        /* non-blocking */
      }
    }

    void sync(true);
    const intervalId = setInterval(() => void sync(false), RESYNC_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void sync(false);
    });

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      sub.remove();
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
