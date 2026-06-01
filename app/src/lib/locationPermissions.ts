import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export type LocationPermissionSummary = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
  hasWhenInUse: boolean;
  hasAlways: boolean;
};

export async function getLocationPermissionSummary(): Promise<LocationPermissionSummary> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    foreground: fg.status,
    background: bg.status,
    hasWhenInUse: fg.status === Location.PermissionStatus.GRANTED,
    hasAlways: bg.status === Location.PermissionStatus.GRANTED,
  };
}

/**
 * Requests When In Use, then Always (background). iOS shows the upgrade dialog after foreground is granted.
 */
export async function requestAlwaysLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  const fg = await Location.requestForegroundPermissionsAsync();
  const foregroundGranted = fg.status === Location.PermissionStatus.GRANTED;
  if (!foregroundGranted) {
    return { foregroundGranted: false, backgroundGranted: false };
  }
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return {
      foregroundGranted: true,
      backgroundGranted: bg.status === Location.PermissionStatus.GRANTED,
    };
  } catch {
    return { foregroundGranted: true, backgroundGranted: false };
  }
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

export function promptOpenSettingsForAlways(
  title: string,
  body: string,
  openLabel: string,
  cancelLabel: string,
): void {
  if (Platform.OS === 'web') return;
  Alert.alert(title, body, [
    { text: cancelLabel, style: 'cancel' },
    { text: openLabel, onPress: openAppSettings },
  ]);
}
