import * as SecureStore from 'expo-secure-store';

const KEY = 'cafe_social_bg_api_bearer_v1';

export async function setBackgroundApiToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getBackgroundApiToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
