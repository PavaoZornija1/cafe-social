import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiPost } from './api';
import { getBackgroundApiToken } from './backgroundApiToken';
import { requestAlwaysLocationPermissions } from './locationPermissions';

export const VENUE_GEOFENCE_TASK = 'VENUE_GEOFENCE_TASK';

export type ProximityGeofenceRegion = {
  venueId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const MIN_RADIUS_M = 100;
const MAX_REGIONS = 20;

if (!TaskManager.isTaskDefined(VENUE_GEOFENCE_TASK)) {
  TaskManager.defineTask(VENUE_GEOFENCE_TASK, async (body) => {
    const { data, error } = body;
    if (error) return;
    if (!data || typeof data !== 'object') return;

    const { eventType, region } = data as {
      eventType: Location.LocationGeofencingEventType;
      region: Location.LocationRegion;
    };
    const venueId = region.identifier;
    if (!venueId) return;

    const kind: 'enter' | 'exit' =
      eventType === Location.LocationGeofencingEventType.Enter ? 'enter' : 'exit';
    const token = await getBackgroundApiToken();
    if (!token) return;

    const sec = Math.floor(Date.now() / 1000);
    const clientDedupeKey = `${venueId}:${kind}:${sec}`;

    try {
      await apiPost<{ id: string; duplicate?: boolean }>(
        '/social/me/geofence-event',
        { venueId, kind, clientDedupeKey },
        token,
      );
    } catch {
      /* best-effort */
    }
  });
}

/** @deprecated Use {@link syncProximityGeofenceRegions} for partner arrival alerts. */
export async function syncVenueGeofenceMonitoring(
  opts: {
    venueId: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null,
): Promise<void> {
  if (!opts) {
    await stopProximityGeofenceMonitoring();
    return;
  }
  await syncProximityGeofenceRegions([
    {
      venueId: opts.venueId,
      latitude: opts.latitude,
      longitude: opts.longitude,
      radiusMeters: opts.radiusMeters,
    },
  ]);
}

export async function stopProximityGeofenceMonitoring(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(VENUE_GEOFENCE_TASK);
    if (started) {
      await Location.stopGeofencingAsync(VENUE_GEOFENCE_TASK);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer {@link requestAlwaysLocationPermissions} from `./locationPermissions`. */
export const requestProximityGeofencePermissions = requestAlwaysLocationPermissions;

/**
 * Registers up to 20 circular arrival zones (nearest partner venues).
 * Enter/exit events POST to `/social/me/geofence-event`, which records visit days
 * and starts dwell-based order nudges even when the app is in the background.
 * Requires foreground location; background ("Always") improves delivery when the app is not open.
 */
export async function syncProximityGeofenceRegions(
  regions: ProximityGeofenceRegion[],
): Promise<void> {
  await stopProximityGeofenceMonitoring();

  if (regions.length === 0) return;

  const perms = await requestProximityGeofencePermissions();
  if (!perms.foregroundGranted) return;

  const mapped = regions.slice(0, MAX_REGIONS).map((r) => ({
    identifier: r.venueId,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: Math.min(Math.max(r.radiusMeters, MIN_RADIUS_M), 4_000_000),
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  try {
    await Location.startGeofencingAsync(VENUE_GEOFENCE_TASK, mapped);
  } catch {
    /* simulators often lack geofencing */
  }
}
