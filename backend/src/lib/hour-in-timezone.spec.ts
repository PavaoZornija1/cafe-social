import { hourInTimeZone } from './hour-in-timezone';

describe('hourInTimeZone', () => {
  it('returns hour 0–23 for a valid IANA zone', () => {
    const utc = new Date('2026-06-15T12:00:00.000Z');
    const h = hourInTimeZone(utc, 'Europe/Zagreb');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });

  it('falls back to UTC hour on invalid timezone', () => {
    const utc = new Date('2026-06-15T15:30:00.000Z');
    const h = hourInTimeZone(utc, 'Not/A_Real_Zone_xxx');
    expect(h).toBe(utc.getUTCHours());
  });
});
