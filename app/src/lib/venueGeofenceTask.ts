import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiPost } from './api';
import { getBackgroundApiToken } from './backgroundApiToken';

export const VENUE_GEOFENCE_TASK = 'VENUE_GEOFENCE_TASK';

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

export async function syncVenueGeofenceMonitoring(
  opts: {
    venueId: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null,
): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(VENUE_GEOFENCE_TASK);
    if (started) {
      await Location.stopGeofencingAsync(VENUE_GEOFENCE_TASK);
    }
  } catch {
    /* ignore */
  }

  if (!opts) return;

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) return;

  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== Location.PermissionStatus.GRANTED) {
      /* Region updates may be limited without “Always”; still register for best-effort. */
    }
  } catch {
    /* older platforms / web */
  }

  const radius = Math.min(Math.max(opts.radiusMeters, 100), 4_000_000);

  try {
    await Location.startGeofencingAsync(VENUE_GEOFENCE_TASK, [
      {
        identifier: opts.venueId,
        latitude: opts.latitude,
        longitude: opts.longitude,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
  } catch {
    /* simulators often lack geofencing */
  }
}
