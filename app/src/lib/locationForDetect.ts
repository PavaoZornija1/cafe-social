import { Platform } from 'react-native';

export type Coordinates = { lat: number; lng: number };

/**
 * Requests foreground permission and returns current coords, or null if denied / error.
 * Web: no native module — skip import so Metro/web builds don't crash.
 */
export async function getCoordinatesForVenueDetect(): Promise<Coordinates | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Location = await import('expo-location');
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
