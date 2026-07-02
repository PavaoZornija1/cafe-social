import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'friend_invite_cache_v1';

export type CachedFriendInvite = {
  token: string;
  expiresAt: string;
  qrPayload: string;
  username: string;
};

export async function cacheFriendInvite(invite: CachedFriendInvite): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
}

export async function loadCachedFriendInvite(): Promise<CachedFriendInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedFriendInvite;
  } catch {
    return null;
  }
}

export function isFriendInviteValid(expiresAt: string, bufferMs = 60_000): boolean {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires > Date.now() + bufferMs;
}
