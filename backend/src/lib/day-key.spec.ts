import { previousUtcDayKey, utcDayKey } from './day-key';

describe('utcDayKey', () => {
  it('returns YYYY-MM-DD in UTC', () => {
    expect(utcDayKey(new Date('2026-04-29T03:00:00.000Z'))).toBe('2026-04-29');
  });

  it('defaults to today in UTC', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    expect(utcDayKey()).toBe('2026-08-01');
    jest.useRealTimers();
  });
});

describe('previousUtcDayKey', () => {
  it('steps back one UTC calendar day', () => {
    expect(previousUtcDayKey('2026-04-29')).toBe('2026-04-28');
    expect(previousUtcDayKey('2026-01-01')).toBe('2025-12-31');
  });
});
