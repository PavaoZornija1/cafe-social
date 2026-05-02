import { haversineKm } from './haversine-km';

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(45.81, 15.97, 45.81, 15.97)).toBeLessThan(0.0001);
  });

  it('returns ~111 km for one degree latitude at same longitude', () => {
    const km = haversineKm(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});
