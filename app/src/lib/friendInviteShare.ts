import type { TFunction } from 'i18next';
import { Share } from 'react-native';
import { apiPost } from './api';

export async function createAndShareFriendInviteLink(
  jwt: string | null,
  t: TFunction,
): Promise<void> {
  if (!jwt) {
    throw new Error('Not authenticated');
  }
  const res = await apiPost<{
    token: string;
    expiresAt: string;
    maxUses: number;
  }>('/invites/friend-link', {}, jwt);
  const url = `cafesocial://redeem?token=${encodeURIComponent(res.token)}`;
  await Share.share({
    message: t('friends.shareFriendInviteMessage', { url, raw: res.token }),
    title: 'Cafe Social',
  });
}
