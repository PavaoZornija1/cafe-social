/** Hour 0–23 in the given IANA timezone for an instant. */
export function hourInTimeZone(isoDate: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(isoDate);
    const h = parts.find((p) => p.type === 'hour')?.value;
    return Math.min(23, Math.max(0, parseInt(h ?? '0', 10)));
  } catch {
    return isoDate.getUTCHours();
  }
}
