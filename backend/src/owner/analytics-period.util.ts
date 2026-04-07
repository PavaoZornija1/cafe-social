export type AnalyticsPeriod = {
  start: Date;
  end: Date;
  startDay: string;
  endDay: string;
};

function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
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
export function resolveAnalyticsPeriod(
  daysInput: number | undefined,
  fromYmd: string | undefined,
  toYmd: string | undefined,
): AnalyticsPeriod {
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
    const end = new Date(endDayDate);
    end.setUTCHours(23, 59, 59, 999);
    const maxMs = 366 * 24 * 60 * 60 * 1000;
    let startAdj = start;
    if (end.getTime() - startAdj.getTime() > maxMs) {
      startAdj = new Date(end.getTime() - maxMs);
    }
    return {
      start: startAdj,
      end,
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
  return { start, end, startDay, endDay };
}
