import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cafe_social_bg_api_bearer_v2';
const EXPIRES_KEY = 'cafe_social_bg_api_expires_v2';
/** Refresh when fewer than 7 days remain on the 30-day token. */
const REFRESH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/** Readable while the phone is locked (after first unlock since boot) — required for OS geofence wakes. */
const KEYCHAIN_OPTS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

export async function setBackgroundApiToken(
  token: string | null,
  expiresAtIso?: string | null,
): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(EXPIRES_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, KEYCHAIN_OPTS);
  if (expiresAtIso) {
    await SecureStore.setItemAsync(EXPIRES_KEY, expiresAtIso, KEYCHAIN_OPTS);
  }
}

export async function getBackgroundApiToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function backgroundTokenNeedsRefresh(): Promise<boolean> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return true;
    const expiresRaw = await SecureStore.getItemAsync(EXPIRES_KEY);
    if (!expiresRaw) return true;
    const expiresAt = Date.parse(expiresRaw);
    if (!Number.isFinite(expiresAt)) return true;
    return expiresAt - Date.now() < REFRESH_WITHIN_MS;
  } catch {
    return true;
  }
}
