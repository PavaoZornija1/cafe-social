import { apiPost } from './api';

export type FriendInviteDto = {
  token: string;
  expiresAt: string;
  maxUses: number;
};

export function createFriendInvite(jwt: string): Promise<FriendInviteDto> {
  return apiPost<FriendInviteDto>('/invites/friend-link', {}, jwt);
}

export function buildFriendInviteQrPayload(token: string): string {
  return JSON.stringify({
    kind: 'friend_invite',
    token: token.trim(),
    v: 1,
  });
}

export function buildFriendInviteDeepLink(token: string): string {
  return `cafesocial://redeem?token=${encodeURIComponent(token.trim())}`;
}
