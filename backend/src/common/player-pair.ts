/** Canonical ordering for friendship edges (stable unique key). */
export function orderedPlayerPair(
  a: string,
  b: string,
): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}
