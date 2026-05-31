import {
  normalizeProximityAlertRadiusMeters,
  PROXIMITY_ALERT_RADIUS_DEFAULT,
} from './proximity-alert-radius';

describe('normalizeProximityAlertRadiusMeters', () => {
  it('preserves presets and custom values within bounds', () => {
    expect(normalizeProximityAlertRadiusMeters(50)).toBe(50);
    expect(normalizeProximityAlertRadiusMeters(100)).toBe(100);
    expect(normalizeProximityAlertRadiusMeters(200)).toBe(200);
    expect(normalizeProximityAlertRadiusMeters(120)).toBe(120);
    expect(normalizeProximityAlertRadiusMeters('175')).toBe(175);
  });

  it('clamps out-of-range values and defaults invalid input', () => {
    expect(normalizeProximityAlertRadiusMeters(10)).toBe(25);
    expect(normalizeProximityAlertRadiusMeters(900)).toBe(500);
    expect(normalizeProximityAlertRadiusMeters(null)).toBe(PROXIMITY_ALERT_RADIUS_DEFAULT);
    expect(normalizeProximityAlertRadiusMeters(undefined)).toBe(PROXIMITY_ALERT_RADIUS_DEFAULT);
  });
});
