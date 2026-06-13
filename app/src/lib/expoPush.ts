import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { resolvePostAuthTarget } from '../navigation/resolvePostAuthTarget';
import { apiDelete, apiPost } from './api';

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

async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('social', {
    name: 'Friends & parties',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('match', {
    name: 'Word matches',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('partner_marketing', {
    name: 'Partner offers & perks',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function resolveExpoPushToken(): Promise<string | null> {
  const projectId = resolveExpoProjectId();
  const expoToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return expoToken.data;
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

  await ensureAndroidNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== 'granted') return;

  const token = await resolveExpoPushToken();
  if (!token) return;

  try {
    await apiPost<{ ok: boolean }>(
      '/players/me/push-token',
      { expoPushToken: token },
      authToken,
    );
  } catch {
    /* non-fatal */
  }
}

/** Removes this device's Expo token from the server (call before sign-out). */
export async function unregisterExpoPushTokenFromBackend(
  getAuthToken: () => Promise<string | null | undefined>,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;

  const authToken = await getAuthToken();
  if (!authToken) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const token = await resolveExpoPushToken();
    if (!token) return;
    await apiDelete(
      `/players/me/push-token?expoPushToken=${encodeURIComponent(token)}`,
      authToken,
    );
  } catch {
    /* non-fatal */
  }
}
