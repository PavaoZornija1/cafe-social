import type { ConfigService } from '@nestjs/config';

export type VenueAttributionConfig = {
  enterWindowMinutes: number;
  minDwellMinutes: number;
  nudgeVenueCooldownMinutes: number;
  nudgeVenueDailyMax: number;
  nudgeGlobalDailyMax: number;
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function loadVenueAttributionConfig(
  config: ConfigService,
): VenueAttributionConfig {
  return {
    enterWindowMinutes: positiveInt(
      config.get<string>('ATTRIBUTION_ENTER_WINDOW_MINUTES'),
      15,
    ),
    minDwellMinutes: positiveInt(
      config.get<string>('ATTRIBUTION_MIN_DWELL_MINUTES'),
      15,
    ),
    nudgeVenueCooldownMinutes: positiveInt(
      config.get<string>('PROXIMITY_NUDGE_VENUE_COOLDOWN_MINUTES'),
      240,
    ),
    nudgeVenueDailyMax: positiveInt(
      config.get<string>('PROXIMITY_NUDGE_VENUE_DAILY_MAX'),
      3,
    ),
    nudgeGlobalDailyMax: positiveInt(
      config.get<string>('PROXIMITY_NUDGE_GLOBAL_DAILY_MAX'),
      5,
    ),
  };
}

export const GEOFENCE_BOUNDARY_PROXIMITY_RING = 'proximity_ring' as const;
