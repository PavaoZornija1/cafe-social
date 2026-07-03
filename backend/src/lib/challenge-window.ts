import type { ChallengeScheduleType } from '@prisma/client';

export type ChallengeScheduleInput = {
  scheduleType: ChallengeScheduleType;
  activeFrom?: Date | null;
  activeTo?: Date | null;
  dailyStartMinutes?: number | null;
  dailyEndMinutes?: number | null;
  venueTimeZone?: string | null;
};

export type ChallengeWindowStatus = 'active' | 'upcoming' | 'ended' | 'inactive';

export type ChallengeWindowInfo = {
  status: ChallengeWindowStatus;
  /** When status is `upcoming`, approximate UTC instant the window next opens. */
  nextOpensAt: Date | null;
};

/** Challenge “happy hour” / scheduled window. */
export function isChallengeActiveWindow(
  schedule: ChallengeScheduleInput,
  now = new Date(),
): boolean {
  return getChallengeWindowStatus(schedule, now).status === 'active';
}

export function getChallengeWindowStatus(
  schedule: ChallengeScheduleInput,
  now = new Date(),
): ChallengeWindowInfo {
  switch (schedule.scheduleType) {
    case 'ALWAYS':
      return { status: 'active', nextOpensAt: null };
    case 'FIXED_RANGE':
      return fixedRangeStatus(schedule, now);
    case 'DAILY_RECURRING':
      return dailyRecurringStatus(schedule, now);
    default: {
      const _exhaustive: never = schedule.scheduleType;
      return _exhaustive;
    }
  }
}

function fixedRangeStatus(
  schedule: ChallengeScheduleInput,
  now: Date,
): ChallengeWindowInfo {
  if (schedule.activeFrom && now < schedule.activeFrom) {
    return { status: 'upcoming', nextOpensAt: schedule.activeFrom };
  }
  if (schedule.activeTo && now > schedule.activeTo) {
    return { status: 'ended', nextOpensAt: null };
  }
  return { status: 'active', nextOpensAt: null };
}

function dailyRecurringStatus(
  schedule: ChallengeScheduleInput,
  now: Date,
): ChallengeWindowInfo {
  const start = schedule.dailyStartMinutes;
  const end = schedule.dailyEndMinutes;
  if (start == null || end == null) {
    return { status: 'active', nextOpensAt: null };
  }

  const tz = schedule.venueTimeZone?.trim() || 'UTC';
  const minutes = localMinutesSinceMidnight(now, tz);

  if (isInDailyWindow(minutes, start, end)) {
    return { status: 'active', nextOpensAt: null };
  }

  const nextOpensAt = estimateNextDailyOpen(now, tz, start, minutes, start, end);
  return { status: 'upcoming', nextOpensAt };
}

function isInDailyWindow(minutes: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function localMinutesSinceMidnight(now: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function estimateNextDailyOpen(
  now: Date,
  timeZone: string,
  dailyStartMinutes: number,
  currentMinutes: number,
  windowStart: number,
  windowEnd: number,
): Date {
  const inWindowLaterToday =
    windowStart < windowEnd
      ? currentMinutes < windowStart
      : currentMinutes < windowStart && currentMinutes >= windowEnd;

  if (inWindowLaterToday) {
    return addLocalMinutes(now, timeZone, dailyStartMinutes - currentMinutes);
  }
  const minutesUntilTomorrow =
    windowStart < windowEnd
      ? 24 * 60 - currentMinutes + windowStart
      : dailyStartMinutes - currentMinutes + (currentMinutes >= windowEnd ? 0 : 24 * 60);
  return addLocalMinutes(now, timeZone, minutesUntilTomorrow);
}

function addLocalMinutes(now: Date, timeZone: string, deltaMinutes: number): Date {
  return new Date(now.getTime() + deltaMinutes * 60 * 1000);
}

/** Human-readable daily window in venue local time, e.g. "14:00–15:00". */
export function formatDailyWindowLabel(
  dailyStartMinutes: number,
  dailyEndMinutes: number,
  timeZone?: string | null,
): string {
  const tz = timeZone?.trim() || 'UTC';
  const start = minutesToClock(dailyStartMinutes);
  const end = minutesToClock(dailyEndMinutes);
  return `${start}–${end} (${tz})`;
}

function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
