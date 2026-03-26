export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function previousUtcDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
