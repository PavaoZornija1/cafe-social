import { apiPost } from './api';

export type RedeemInviteResult = {
  kind: 'PARTY' | 'FRIEND';
  partyId?: string;
  joinedParty?: boolean;
};

export function redeemFriendInvite(jwt: string, token: string): Promise<RedeemInviteResult> {
  return apiPost<RedeemInviteResult>('/invites/redeem', { token: token.trim() }, jwt);
}
