import type { TFunction } from 'i18next';
import { Share } from 'react-native';

import { buildFriendInviteDeepLink, createFriendInvite } from './friendInviteApi';

export async function createAndShareFriendInviteLink(
  jwt: string | null,
  t: TFunction,
): Promise<void> {
  if (!jwt) {
    throw new Error('Not authenticated');
  }
  const res = await createFriendInvite(jwt);
  const url = buildFriendInviteDeepLink(res.token);
  await Share.share({
    message: t('friends.shareFriendInviteMessage', { url, raw: res.token }),
    title: 'Cafe Social',
  });
}
