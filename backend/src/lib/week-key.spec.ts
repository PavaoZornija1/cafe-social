import { isoWeekKeyUTC } from './week-key';

describe('isoWeekKeyUTC', () => {
  it('returns YYYY-Www pattern', () => {
    const key = isoWeekKeyUTC(new Date('2026-03-16T12:00:00.000Z'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('is stable for a known UTC instant', () => {
    expect(isoWeekKeyUTC(new Date('2026-01-04T00:00:00.000Z'))).toBe('2026-W01');
  });

  it('defaults to current date', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    expect(isoWeekKeyUTC()).toMatch(/^2026-W/);
    jest.useRealTimers();
  });
});
