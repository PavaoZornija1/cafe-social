import { isChallengeActiveWindow, getChallengeWindowStatus } from './challenge-window';

describe('isChallengeActiveWindow', () => {
  const noon = new Date('2026-06-15T12:00:00.000Z');

  it('returns true for ALWAYS schedule', () => {
    expect(isChallengeActiveWindow({ scheduleType: 'ALWAYS' }, noon)).toBe(true);
  });

  it('returns false before activeFrom on FIXED_RANGE', () => {
    const from = new Date('2026-06-16T00:00:00.000Z');
    expect(
      isChallengeActiveWindow({ scheduleType: 'FIXED_RANGE', activeFrom: from, activeTo: null }, noon),
    ).toBe(false);
  });

  it('returns false after activeTo on FIXED_RANGE', () => {
    const to = new Date('2026-06-14T00:00:00.000Z');
    expect(
      isChallengeActiveWindow({ scheduleType: 'FIXED_RANGE', activeFrom: null, activeTo: to }, noon),
    ).toBe(false);
  });

  it('returns true when now is inside FIXED_RANGE', () => {
    const from = new Date('2026-06-15T00:00:00.000Z');
    const to = new Date('2026-06-15T23:59:59.000Z');
    expect(
      isChallengeActiveWindow({ scheduleType: 'FIXED_RANGE', activeFrom: from, activeTo: to }, noon),
    ).toBe(true);
  });

  it('returns upcoming before daily window', () => {
    const info = getChallengeWindowStatus(
      {
        scheduleType: 'DAILY_RECURRING',
        dailyStartMinutes: 14 * 60,
        dailyEndMinutes: 15 * 60,
        venueTimeZone: 'UTC',
      },
      new Date('2026-06-15T10:00:00.000Z'),
    );
    expect(info.status).toBe('upcoming');
    expect(info.nextOpensAt).not.toBeNull();
  });

  it('returns active inside daily window', () => {
    const info = getChallengeWindowStatus(
      {
        scheduleType: 'DAILY_RECURRING',
        dailyStartMinutes: 14 * 60,
        dailyEndMinutes: 15 * 60,
        venueTimeZone: 'UTC',
      },
      new Date('2026-06-15T14:30:00.000Z'),
    );
    expect(info.status).toBe('active');
  });
});
