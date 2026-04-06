import { Platform } from 'react-native';

export type Coordinates = { lat: number; lng: number };

export type VenueDetectLocationAccuracy = 'balanced' | 'high';

/**
 * Requests foreground permission and returns current coords, or null if denied / error.
 * Web: no native module — skip import so Metro/web builds don't crash.
 *
 * Use `high` for server checks that require point-in-polygon geofence proof (redeems, at-venue challenges).
 */
export async function getCoordinatesForVenueDetect(
  accuracy: VenueDetectLocationAccuracy = 'balanced',
): Promise<Coordinates | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const expoAccuracy =
      accuracy === 'high' ? Location.Accuracy.High : Location.Accuracy.Balanced;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: expoAccuracy,
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
