import * as Location from 'expo-location';

export type Coordinates = { lat: number; lng: number };

/**
 * Requests foreground permission and returns current coords, or null if denied / error.
 */
export async function getCoordinatesForVenueDetect(): Promise<Coordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function buildDetectQuery(coords: Coordinates | null): string {
  if (!coords) return '';
  return `?lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(String(coords.lng))}`;
}
