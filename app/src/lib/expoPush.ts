import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { resolvePostAuthTarget } from '../navigation/resolvePostAuthTarget';
import { apiPost } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveExpoProjectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Requests notification permission (if needed), obtains Expo push token, registers with API.
 * No-op on simulators / web. Safe to call multiple times (upserts token server-side).
 */
export async function registerExpoPushTokenWithBackend(
  getAuthToken: () => Promise<string | null | undefined>,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;

  const authToken = await getAuthToken();
  if (!authToken) return;
  const postOnboarding = await resolvePostAuthTarget(getAuthToken);
  if (postOnboarding === 'Onboarding') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== 'granted') return;

  const projectId = resolveExpoProjectId();
  const expoToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  try {
    await apiPost<{ ok: boolean }>(
      '/players/me/push-token',
      { expoPushToken: expoToken.data },
      authToken,
    );
  } catch {
    /* non-fatal */
  }
}
