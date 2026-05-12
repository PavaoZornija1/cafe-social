/**
 * Mirrors backend `resolveAnalyticsPeriod` (`backend/src/owner/analytics-period.util.ts`)
 * so the admin portal can compute the prior comparison window client-side.
 */

export type AnalyticsPeriodClient = {
  startDay: string;
  endDay: string;
};

function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD only; interpreted as UTC midnight start of that day. */
export function parseYmdUtc(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Either `days` rolling window ending today, or inclusive `from`–`to` YYYY-MM-DD (UTC).
 * Caps range at 366 days. `from`/`to` take precedence when both valid.
 */
export function resolveFrontendAnalyticsPeriod(
  daysInput: number | undefined,
  fromYmd: string | undefined,
  toYmd: string | undefined,
): AnalyticsPeriodClient {
  const fromParsed = fromYmd ? parseYmdUtc(fromYmd) : null;
  const toParsed = toYmd ? parseYmdUtc(toYmd) : null;

  if (fromParsed && toParsed) {
    let start = fromParsed;
    let endDayDate = toParsed;
    if (start.getTime() > endDayDate.getTime()) {
      const tmp = start;
      start = endDayDate;
      endDayDate = tmp;
    }
    const maxMs = 366 * 24 * 60 * 60 * 1000;
    let startAdj = start;
    if (endDayDate.getTime() - startAdj.getTime() > maxMs) {
      startAdj = new Date(endDayDate.getTime() - maxMs);
    }
    return {
      startDay: utcDayKey(startAdj),
      endDay: utcDayKey(endDayDate),
    };
  }

  const safeDays = Math.min(Math.max(daysInput ?? 30, 1), 90);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  start.setUTCHours(0, 0, 0, 0);
  const endDay = utcDayKey(end);
  const startDay = utcDayKey(start);
  return { startDay, endDay };
}

function utcYmdToTime(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getTime();
}

/** Inclusive calendar day count between two UTC YYYY-MM-DD keys. */
export function inclusiveUtcDaySpan(startDay: string, endDay: string): number {
  const a = utcYmdToTime(startDay);
  const b = utcYmdToTime(endDay);
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

export function addUtcDaysYmd(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return utcDayKey(d);
}

/** Prior block of the same length immediately before `startDay` (UTC). */
export function previousComparisonUtcRange(
  startDay: string,
  endDay: string,
): { from: string; to: string } {
  const n = inclusiveUtcDaySpan(startDay, endDay);
  const prevEnd = addUtcDaysYmd(startDay, -1);
  const prevStart = addUtcDaysYmd(startDay, -n);
  return { from: prevStart, to: prevEnd };
}
