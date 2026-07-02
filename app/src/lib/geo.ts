/** Great-circle distance in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rough walk time at ~5 km/h. */
export function walkMinutesFromKm(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 5) * 60));
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${(Math.round(distanceKm * 10) / 10).toFixed(1)} km`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function venueInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
