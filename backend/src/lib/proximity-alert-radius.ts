export const PROXIMITY_ALERT_RADIUS_PRESETS = [50, 100, 200] as const;

export type ProximityAlertRadiusPreset = (typeof PROXIMITY_ALERT_RADIUS_PRESETS)[number];

/** @deprecated use PROXIMITY_ALERT_RADIUS_PRESETS */
export const PROXIMITY_ALERT_RADIUS_OPTIONS = PROXIMITY_ALERT_RADIUS_PRESETS;

export type ProximityAlertRadiusMeters = ProximityAlertRadiusPreset;

export const PROXIMITY_ALERT_RADIUS_MIN = 25;
export const PROXIMITY_ALERT_RADIUS_MAX = 500;
export const PROXIMITY_ALERT_RADIUS_DEFAULT = 100;

/** Clamp stored/custom radius for geofence registration and API responses. */
export function normalizeProximityAlertRadiusMeters(raw: unknown): number {
  if (raw === null || raw === undefined) return PROXIMITY_ALERT_RADIUS_DEFAULT;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return PROXIMITY_ALERT_RADIUS_DEFAULT;
  return Math.round(
    Math.min(PROXIMITY_ALERT_RADIUS_MAX, Math.max(PROXIMITY_ALERT_RADIUS_MIN, n)),
  );
}

export function isProximityAlertRadiusPreset(n: number): n is ProximityAlertRadiusPreset {
  return (PROXIMITY_ALERT_RADIUS_PRESETS as readonly number[]).includes(n);
}
