import { utcDayKeyDaysAgo, utcWeekDayKeyRange } from './engagement-dates';

describe('utcDayKeyDaysAgo', () => {
  it('returns calendar day N days before from', () => {
    const from = new Date('2026-06-10T15:00:00.000Z');
    expect(utcDayKeyDaysAgo(0, from)).toBe('2026-06-10');
    expect(utcDayKeyDaysAgo(1, from)).toBe('2026-06-09');
    expect(utcDayKeyDaysAgo(10, from)).toBe('2026-05-31');
  });

  it('defaults from to current instant', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));
    expect(utcDayKeyDaysAgo(1)).toBe('2026-03-04');
    jest.useRealTimers();
  });
});

describe('utcWeekDayKeyRange', () => {
  it('returns Monday–Sunday UTC week containing from', () => {
    const { start, end } = utcWeekDayKeyRange(new Date('2026-06-11T12:00:00.000Z')); // Thursday
    expect(start <= end).toBe(true);
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const span =
      (new Date(`${end}T12:00:00.000Z`).getTime() -
        new Date(`${start}T12:00:00.000Z`).getTime()) /
      86400000;
    expect(span).toBe(6);
  });

  it('defaults from to current instant', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-04T12:00:00.000Z'));
    const { start, end } = utcWeekDayKeyRange();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    jest.useRealTimers();
  });
});
